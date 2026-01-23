"""
Drawing Comparison Service using Computer Vision

This service provides deterministic, pixel-accurate change detection between
two construction drawing revisions using OpenCV.

Architecture:
1. Feature-based alignment (ORB) to handle scale/offset differences
2. Pixel difference with configurable sensitivity
3. Contour detection to find bounding boxes of changed regions
4. Returns accurate coordinates for each detected change

Usage:
    python drawing_compare.py  # Starts Flask server on port 5050

API Endpoints:
    POST /compare - Compare two images
    GET /health - Health check
"""

import cv2
import numpy as np
from flask import Flask, request, jsonify
import base64
import logging
from typing import List, Dict, Tuple, Optional
import io

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
DEFAULT_CONFIG = {
    'max_features': 500,           # ORB features for alignment
    'good_match_percent': 0.15,    # Top % of matches to use
    'diff_threshold': 30,          # Pixel difference threshold (0-255)
    'min_contour_area': 500,       # Minimum change region size in pixels
    'blur_kernel': 5,              # Gaussian blur kernel size
    'dilate_iterations': 3,        # Morphological dilation iterations
    'erode_iterations': 1,         # Morphological erosion iterations
}


def decode_base64_image(base64_string: str) -> np.ndarray:
    """Decode base64 string to OpenCV image."""
    # Remove data URL prefix if present
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]

    img_data = base64.b64decode(base64_string)
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Failed to decode image")

    return img


def encode_image_base64(img: np.ndarray, format: str = '.png') -> str:
    """Encode OpenCV image to base64 string."""
    _, buffer = cv2.imencode(format, img)
    return base64.b64encode(buffer).decode('utf-8')


def align_images(img_reference: np.ndarray, img_to_align: np.ndarray,
                 config: Dict) -> Tuple[np.ndarray, bool, Dict]:
    """
    Align img_to_align to img_reference using ORB feature matching.

    Returns:
        - Aligned image
        - Success flag
        - Alignment info (homography matrix, match count, etc.)
    """
    # Convert to grayscale
    gray_ref = cv2.cvtColor(img_reference, cv2.COLOR_BGR2GRAY)
    gray_align = cv2.cvtColor(img_to_align, cv2.COLOR_BGR2GRAY)

    # Detect ORB features
    orb = cv2.ORB_create(nfeatures=config['max_features'])
    keypoints_ref, descriptors_ref = orb.detectAndCompute(gray_ref, None)
    keypoints_align, descriptors_align = orb.detectAndCompute(gray_align, None)

    if descriptors_ref is None or descriptors_align is None:
        logger.warning("No features detected in one or both images")
        return img_to_align, False, {'error': 'No features detected'}

    # Match features using BFMatcher with Hamming distance
    matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = matcher.match(descriptors_ref, descriptors_align)

    # Sort by distance (quality)
    matches = sorted(matches, key=lambda x: x.distance)

    # Take top matches
    num_good_matches = int(len(matches) * config['good_match_percent'])
    num_good_matches = max(4, num_good_matches)  # Need at least 4 for homography
    good_matches = matches[:num_good_matches]

    if len(good_matches) < 4:
        logger.warning(f"Not enough good matches: {len(good_matches)}")
        return img_to_align, False, {'error': 'Not enough feature matches'}

    # Extract matched keypoint coordinates
    points_ref = np.float32([keypoints_ref[m.queryIdx].pt for m in good_matches])
    points_align = np.float32([keypoints_align[m.trainIdx].pt for m in good_matches])

    # Find homography using RANSAC
    homography, mask = cv2.findHomography(points_align, points_ref, cv2.RANSAC, 5.0)

    if homography is None:
        logger.warning("Failed to compute homography")
        return img_to_align, False, {'error': 'Homography computation failed'}

    # Warp the image to align
    height, width = img_reference.shape[:2]
    aligned = cv2.warpPerspective(img_to_align, homography, (width, height),
                                   borderMode=cv2.BORDER_CONSTANT,
                                   borderValue=(255, 255, 255))

    inliers = np.sum(mask) if mask is not None else 0

    alignment_info = {
        'total_features_ref': len(keypoints_ref),
        'total_features_align': len(keypoints_align),
        'total_matches': len(matches),
        'good_matches': len(good_matches),
        'inliers': int(inliers),
        'homography': homography.tolist() if homography is not None else None
    }

    logger.info(f"Alignment: {inliers} inliers from {len(good_matches)} matches")

    return aligned, True, alignment_info


def compute_difference(img_a: np.ndarray, img_b: np.ndarray,
                       config: Dict) -> Tuple[np.ndarray, np.ndarray]:
    """
    Compute pixel-wise difference between two images.

    Returns:
        - Difference image (grayscale)
        - Binary mask of significant differences
    """
    # Convert to grayscale
    gray_a = cv2.cvtColor(img_a, cv2.COLOR_BGR2GRAY)
    gray_b = cv2.cvtColor(img_b, cv2.COLOR_BGR2GRAY)

    # Apply Gaussian blur to reduce noise
    kernel_size = config['blur_kernel']
    gray_a = cv2.GaussianBlur(gray_a, (kernel_size, kernel_size), 0)
    gray_b = cv2.GaussianBlur(gray_b, (kernel_size, kernel_size), 0)

    # Compute absolute difference
    diff = cv2.absdiff(gray_a, gray_b)

    # Threshold to get binary mask
    _, thresh = cv2.threshold(diff, config['diff_threshold'], 255, cv2.THRESH_BINARY)

    # Morphological operations to clean up
    kernel = np.ones((3, 3), np.uint8)

    # Dilate to connect nearby regions
    thresh = cv2.dilate(thresh, kernel, iterations=config['dilate_iterations'])

    # Erode to remove small noise
    thresh = cv2.erode(thresh, kernel, iterations=config['erode_iterations'])

    return diff, thresh


def find_change_regions(binary_mask: np.ndarray, img_shape: Tuple[int, int],
                        config: Dict) -> List[Dict]:
    """
    Find contours in the binary mask and return bounding boxes.

    Returns list of change regions with normalized coordinates.
    """
    height, width = img_shape[:2]

    # Find contours
    contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL,
                                    cv2.CHAIN_APPROX_SIMPLE)

    regions = []
    min_area = config['min_contour_area']

    for i, contour in enumerate(contours):
        area = cv2.contourArea(contour)

        if area < min_area:
            continue

        # Get bounding rectangle
        x, y, w, h = cv2.boundingRect(contour)

        # Calculate center point (normalized 0-1)
        center_x = (x + w / 2) / width
        center_y = (y + h / 2) / height

        # Normalized dimensions
        norm_width = w / width
        norm_height = h / height

        regions.append({
            'region_id': i + 1,
            'bounding_box': {
                'x': round(center_x, 4),
                'y': round(center_y, 4),
                'width': round(norm_width, 4),
                'height': round(norm_height, 4)
            },
            'pixel_coords': {
                'x': int(x),
                'y': int(y),
                'width': int(w),
                'height': int(h)
            },
            'area_pixels': int(area),
            'area_percent': round((area / (width * height)) * 100, 2)
        })

    # Sort by area (largest first)
    regions.sort(key=lambda r: r['area_pixels'], reverse=True)

    # Re-number after sorting
    for i, region in enumerate(regions):
        region['region_id'] = i + 1

    return regions


def create_diff_visualization(img_a: np.ndarray, img_b: np.ndarray,
                              diff_mask: np.ndarray, regions: List[Dict]) -> np.ndarray:
    """
    Create a visualization image showing differences.

    - Base: newer image (img_b)
    - Red overlay: areas that changed
    - Green boxes: detected region bounding boxes
    """
    # Start with the newer image
    vis = img_b.copy()

    # Create red overlay for changed areas
    red_overlay = np.zeros_like(vis)
    red_overlay[:, :, 2] = diff_mask  # Red channel

    # Blend overlay
    vis = cv2.addWeighted(vis, 0.7, red_overlay, 0.3, 0)

    # Draw bounding boxes
    height, width = vis.shape[:2]
    for region in regions:
        px = region['pixel_coords']
        x, y, w, h = px['x'], px['y'], px['width'], px['height']

        # Green rectangle
        cv2.rectangle(vis, (x, y), (x + w, y + h), (0, 255, 0), 2)

        # Label
        label = f"#{region['region_id']}"
        cv2.putText(vis, label, (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX,
                    0.6, (0, 255, 0), 2)

    return vis


def compare_drawings(img_a_base64: str, img_b_base64: str,
                     config: Optional[Dict] = None) -> Dict:
    """
    Main comparison function.

    Args:
        img_a_base64: Base64 encoded older revision
        img_b_base64: Base64 encoded newer revision
        config: Optional configuration overrides

    Returns:
        Dictionary with comparison results
    """
    # Merge config with defaults
    cfg = {**DEFAULT_CONFIG, **(config or {})}

    try:
        # Decode images
        logger.info("Decoding images...")
        img_a = decode_base64_image(img_a_base64)
        img_b = decode_base64_image(img_b_base64)

        logger.info(f"Image A: {img_a.shape}, Image B: {img_b.shape}")

        # Resize if images have different dimensions
        if img_a.shape != img_b.shape:
            logger.info("Images have different dimensions, resizing B to match A")
            img_b = cv2.resize(img_b, (img_a.shape[1], img_a.shape[0]))

        # Step 1: Align images
        logger.info("Aligning images...")
        img_b_aligned, alignment_success, alignment_info = align_images(
            img_a, img_b, cfg
        )

        # Step 2: Compute difference
        logger.info("Computing difference...")
        diff_gray, diff_mask = compute_difference(img_a, img_b_aligned, cfg)

        # Step 3: Find change regions
        logger.info("Finding change regions...")
        regions = find_change_regions(diff_mask, img_a.shape, cfg)

        logger.info(f"Found {len(regions)} change regions")

        # Step 4: Create visualization
        logger.info("Creating visualization...")
        vis_image = create_diff_visualization(img_a, img_b_aligned, diff_mask, regions)

        # Encode outputs
        diff_image_b64 = encode_image_base64(diff_mask)
        vis_image_b64 = encode_image_base64(vis_image)

        return {
            'success': True,
            'alignment': {
                'success': alignment_success,
                **alignment_info
            },
            'regions': regions,
            'region_count': len(regions),
            'diff_image': f"data:image/png;base64,{diff_image_b64}",
            'visualization': f"data:image/png;base64,{vis_image_b64}",
            'config_used': cfg,
            'image_dimensions': {
                'width': img_a.shape[1],
                'height': img_a.shape[0]
            }
        }

    except Exception as e:
        logger.error(f"Comparison failed: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'regions': [],
            'region_count': 0
        }


# Flask Routes

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'drawing-compare',
        'opencv_version': cv2.__version__
    })


@app.route('/compare', methods=['POST'])
def compare_endpoint():
    """
    Compare two drawing images.

    Request JSON:
    {
        "image_a": "base64...",  // Older revision
        "image_b": "base64...",  // Newer revision
        "config": {              // Optional
            "diff_threshold": 30,
            "min_contour_area": 500,
            ...
        }
    }

    Response JSON:
    {
        "success": true,
        "regions": [...],
        "region_count": 5,
        "diff_image": "data:image/png;base64,...",
        "visualization": "data:image/png;base64,..."
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'success': False, 'error': 'No JSON data provided'}), 400

        image_a = data.get('image_a')
        image_b = data.get('image_b')
        config = data.get('config', {})

        if not image_a or not image_b:
            return jsonify({'success': False, 'error': 'Both image_a and image_b are required'}), 400

        result = compare_drawings(image_a, image_b, config)

        return jsonify(result)

    except Exception as e:
        logger.error(f"API error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/crop', methods=['POST'])
def crop_endpoint():
    """
    Crop a region from an image.

    Request JSON:
    {
        "image": "base64...",
        "bounding_box": {
            "x": 0.3,      // Center X (normalized)
            "y": 0.5,      // Center Y (normalized)
            "width": 0.2,
            "height": 0.15
        },
        "padding": 0.1     // Optional padding percentage
    }
    """
    try:
        data = request.get_json()

        image_b64 = data.get('image')
        bbox = data.get('bounding_box')
        padding = data.get('padding', 0.1)

        if not image_b64 or not bbox:
            return jsonify({'success': False, 'error': 'image and bounding_box required'}), 400

        img = decode_base64_image(image_b64)
        height, width = img.shape[:2]

        # Calculate crop coordinates
        cx, cy = bbox['x'], bbox['y']
        bw, bh = bbox['width'], bbox['height']

        # Add padding
        bw = min(1.0, bw * (1 + padding * 2))
        bh = min(1.0, bh * (1 + padding * 2))

        # Convert to pixel coordinates
        x1 = int(max(0, (cx - bw / 2) * width))
        y1 = int(max(0, (cy - bh / 2) * height))
        x2 = int(min(width, (cx + bw / 2) * width))
        y2 = int(min(height, (cy + bh / 2) * height))

        # Crop
        cropped = img[y1:y2, x1:x2]

        cropped_b64 = encode_image_base64(cropped)

        return jsonify({
            'success': True,
            'cropped_image': f"data:image/png;base64,{cropped_b64}",
            'crop_coords': {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2}
        })

    except Exception as e:
        logger.error(f"Crop error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    print("Starting Drawing Comparison Service...")
    print(f"OpenCV version: {cv2.__version__}")
    print("Endpoints:")
    print("  GET  /health  - Health check")
    print("  POST /compare - Compare two drawings")
    print("  POST /crop    - Crop region from image")
    print("")
    app.run(host='0.0.0.0', port=5050, debug=True)
