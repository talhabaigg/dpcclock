import React, { useState } from 'react';
import axios from 'axios'; // Import axios for API calls
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button'; // Import button component
interface KioskTokenDialogProps {
    kioskId: number; // Define the prop for kioskId
}

const KioskTokenDialog: React.FC<KioskTokenDialogProps> = ({ kioskId }) => {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    // Function to fetch the token from the server using Axios
    const fetchToken = async () => {
        setLoading(true);
        try {
            // Make a GET request to retrieve the token from the server
            const response = await axios.get('/retrieve-kiosk-token'); // Replace with your API endpoint
            setToken(response.data.token);
        } catch (error) {
            console.error('Error fetching token:', error);
            setToken(null); // Handle error and reset token to null
        } finally {
            setLoading(false); // Stop loading state once the request is done
        }
    };

    // Trigger fetching token when the dialog is opened
    const handleDialogOpen = () => {
        setToken(null); // Clear the existing token before fetching a new one
        fetchToken(); // Fetch the token each time the dialog opens
    };

    // Generate the URL with token and kiosk ID as query parameter
    const generateKioskUrl = (token: string | null, kioskId: number) => {
        if (!token) return '';
        return `${window.location.origin}/kiosks/${kioskId}/validate-token?token=${token}`; // Embed the token and kiosk ID in the URL
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="btn btn-primary" onClick={handleDialogOpen}>Show QR</Button>
            </DialogTrigger>

            <DialogContent className="dialog-content">
                <DialogTitle>QR CODE</DialogTitle>
                <DialogDescription>
                    {loading ? (
                        <p>Loading token...</p> // Show loading text while fetching the token
                    ) : token ? (
                        <div className="qr-code-container flex justify-center items-center">
                            <QRCodeSVG value={generateKioskUrl(token, kioskId)} size={256} /> {/* Display the QR code with the URL containing the token and kiosk ID */}
                            <a href={generateKioskUrl(token, kioskId)}>Link</a>
                        </div>
                    ) : (
                        <p>Failed to retrieve token. Please try again.</p> // Show error message if fetching fails
                    )}
                </DialogDescription>
            </DialogContent>
        </Dialog>
    );
};

export default KioskTokenDialog;
