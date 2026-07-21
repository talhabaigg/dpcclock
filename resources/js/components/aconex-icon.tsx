import { SVGProps } from 'react';

/**
 * Aconex brand mark — the orange-and-grey "X" formed by four angled blades.
 * Shown on the "Import from Aconex" integration entry point so it reads
 * instantly as a third-party connection (the same convention Fieldwire,
 * ProcurePro and others use for integration partners).
 *
 * Reproduced as a 24×24 inline SVG (traced from the official logo) so it
 * stays crisp at any size and aligns with the lucide icons it sits beside.
 * Rendered in Aconex's brand colours rather than shadcn tokens — a partner's
 * logo is the accepted exception to the tokens-only convention. Swap for the
 * official vector if a licensed asset becomes available.
 */
export default function AconexIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            {...props}
        >
            {/* Orange blades: top-left and bottom-right */}
            <polygon fill="#E8711C" points="0.1,0.1 6.4,0.1 11.28,11.06 8.19,11.06" />
            <polygon fill="#E8711C" points="12.72,12.63 15.74,12.63 23.9,23.9 17.53,23.61" />
            {/* Grey blades: top-right and bottom-left */}
            <polygon fill="#74746F" points="17.6,0.1 23.9,0.1 16.02,10.82 12.65,11.06" />
            <polygon fill="#74746F" points="8.19,12.63 11.35,12.63 6.4,23.76 0.1,23.9" />
        </svg>
    );
}
