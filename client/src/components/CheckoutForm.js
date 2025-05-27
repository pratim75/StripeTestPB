// client/src/components/CheckoutForm.js
// This is for the *embedded* Payment Element, not the Stripe-hosted checkout.
// Uncomment it in App.js if you want to try this later.
import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

const CheckoutForm = ({ cartItems }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!stripe || !elements) {
            // Stripe.js has not yet loaded.
            // Make sure to disable form submission until Stripe.js has loaded.
            return;
        }

        setIsLoading(true);

        // Fetch a client secret from your server
        // This requires a backend endpoint that creates a PaymentIntent and returns its client_secret
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/create-payment-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cartItems }), // Send cart items to create intent
        });
        const { clientSecret } = await response.json();

        // Confirm the payment
        const { error } = await stripe.confirmPayment({
            elements,
            clientSecret,
            confirmParams: {
                // Make sure to change this to your payment completion page
                return_url: `${process.env.REACT_APP_FRONTEND_URL}/success`, // Or relevant success URL
            },
        });

        // This point will only be reached if there's an immediate error when
        // confirming the payment. Otherwise, your customer will be redirected to
        // your `return_url`. For some payment methods like iDEAL, your customer will
        // be redirected to an intermediate site first to authorize the payment, then
        // redirected to the `return_url`.
        if (error.type === 'card_error' || error.type === 'validation_error') {
            setMessage(error.message);
        } else {
            setMessage('An unexpected error occurred.');
        }

        setIsLoading(false);
    };

    return (
        <form id="payment-form" onSubmit={handleSubmit}>
            <PaymentElement id="payment-element" />
            <button disabled={isLoading || !stripe || !elements} id="submit">
                <span id="button-text">
                    {isLoading ? <div className="spinner" id="spinner"></div> : 'Pay now'}
                </span>
            </button>
            {/* Show any error or success messages */}
            {message && <div id="payment-message">{message}</div>}
        </form>
    );
};

export default CheckoutForm;