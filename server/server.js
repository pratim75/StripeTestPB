// server/server.js
require('dotenv').config(); // MUST be at the very top to load .env variables

const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Apply CORS for all routes (usually first)
app.use(cors());

// 2. Define your WEBHOOK ROUTE *BEFORE* any global express.json() middleware
// This specific route needs the RAW body, so we use express.raw() here.
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // req.body here will be the raw buffer/string, as required by Stripe
        console.log('Webhook received! Verifying signature...');
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        console.log(`Webhook verified. Event type: ${event.type}`);
    } catch (err) {
        // If signature verification fails, this catch block runs
        console.error(`⚠️  Webhook Signature Verification Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log('✅ Checkout Session Completed:', session.id);
            // This is where you'd update your database, fulfill the order, send emails etc.
            // console.log('Session data:', JSON.stringify(session, null, 2)); // For debugging
            break;
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log('✅ Payment Intent Succeeded:', paymentIntent.id);
            break;
        // ... handle other event types as needed ...
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.status(200).json({ received: true });
});


// 3. Apply express.json() for all OTHER routes (AFTER the webhook route)
// This middleware parses JSON bodies for your regular API requests (like /api/create-checkout-session)
app.use(express.json());


// 4. Define your other API routes (like products and checkout session creation)
app.get('/api/products', (req, res) => {
    const products = [
        { id: 'product_1', name: 'Premium Coffee Beans', price: 1500, imageUrl: '/images/coffee.jpg' },
        { id: 'product_2', name: 'Handcrafted Mug', price: 2500, imageUrl: '/images/mug.jpg' },
    ];
    res.json(products);
});

app.post('/api/create-checkout-session', async (req, res) => {
    const { items } = req.body; // req.body here will be a parsed JSON object thanks to app.use(express.json())

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items provided' });
    }

    try {
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'aud',
                product_data: {
                    name: item.name,
                },
                unit_amount: item.price,
            },
            quantity: item.quantity,
        }));

        const successUrl = `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${process.env.FRONTEND_URL}/cancel`;
        // console.log('Sending success_url to Stripe:', successUrl); // Keep these for debugging if needed
        // console.log('Sending cancel_url to Stripe:', cancelUrl);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: successUrl,
            cancel_url: cancelUrl,
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
});


// 5. Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});