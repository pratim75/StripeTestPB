// client/src/App.js
import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
// We are using the Stripe-hosted checkout page for simplicity,
// so 'Elements' and 'CheckoutForm' are not strictly needed here for the basic flow.
// import { Elements } from '@stripe/react-stripe-js';
// import CheckoutForm from './components/CheckoutForm';

import './App.css'; // Make sure you have App.css for basic styling

// Make sure to call `loadStripe` outside of a component’s render to avoid
// recreating the `Stripe` object on every render.
// Use your publishable key (starts with pk_test_).
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function App() {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [showCheckout, setShowCheckout] = useState(false); // To toggle between product list and checkout

    // --- Fetch Products from Backend on Component Mount ---
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                // Ensure REACT_APP_BACKEND_URL is correctly set in client/.env.local
                const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/products`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setProducts(data);
            } catch (error) {
                console.error('Error fetching products:', error);
                // Optionally set an error state here to display a message to the user
            }
        };

        fetchProducts();
    }, []); // Empty dependency array means this runs once on mount

    // --- Cart Management Functions ---
    const addToCart = (productToAdd) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === productToAdd.id);
            if (existingItem) {
                // If product already in cart, increment quantity
                return prevCart.map(item =>
                    item.id === productToAdd.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            // If product not in cart, add it with quantity 1
            return [...prevCart, { ...productToAdd, quantity: 1 }];
        });
    };

    const removeFromCart = (productId) => {
        setCart(prevCart => prevCart.filter(item => item.id !== productId));
    };

    const updateCartQuantity = (productId, newQuantity) => {
        setCart(prevCart => {
            if (newQuantity <= 0) {
                return prevCart.filter(item => item.id !== productId);
            }
            return prevCart.map(item =>
                item.id === productId ? { ...item, quantity: newQuantity } : item
            );
        });
    };

    const getTotalCartPrice = () => {
        // Calculate total price in cents first, then convert to dollars for display
        const totalCents = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        return (totalCents / 100).toFixed(2);
    };

    // --- Checkout Logic ---
    const handleProceedToCheckout = () => {
        if (cart.length === 0) {
            alert("Your cart is empty! Please add some products.");
            return;
        }
        setShowCheckout(true);
    };

    const handleBackToShopping = () => {
        setShowCheckout(false);
    };

    const handleStripeCheckoutRedirect = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Send only necessary item data to the backend (id, name, price, quantity)
                body: JSON.stringify({
                    items: cart.map(item => ({
                        id: item.id,
                        name: item.name,
                        price: item.price, // Price should be in cents from backend
                        quantity: item.quantity
                    }))
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const session = await response.json();
            // Redirect to Stripe Checkout
            const stripe = await stripePromise;
            if (stripe) {
                stripe.redirectToCheckout({ sessionId: session.id });
            } else {
                console.error("Stripe.js has not loaded correctly.");
                alert("Payment gateway not ready. Please try again.");
            }
        } catch (error) {
            console.error('Error initiating Stripe Checkout:', error);
            alert(`Could not initiate checkout: ${error.message}. Please try again.`);
        }
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>Pratim's Online Store</h1>
                <nav>
                    <span className="cart-summary">
                        Cart ({cart.reduce((total, item) => total + item.quantity, 0)} items) - Total: ${getTotalCartPrice()}
                    </span>
                    {!showCheckout && (
                        <button onClick={handleProceedToCheckout} disabled={cart.length === 0}>
                            Proceed to Checkout
                        </button>
                    )}
                    {showCheckout && (
                        <button onClick={handleBackToShopping}>
                            &larr; Back to Shopping
                        </button>
                    )}
                </nav>
            </header>

            <main>
                {!showCheckout ? (
                    // --- Product Listing View ---
                    <div className="product-list">
                        {products.length > 0 ? (
                            products.map(product => (
                                <div key={product.id} className="product-card">
                                    {/* You'll need to place actual images in public/images/ */}
                                    <img src={product.imageUrl} alt={product.name} className="product-image" />
                                    <h2>{product.name}</h2>
                                    <p>${(product.price / 100).toFixed(2)}</p> {/* Display price in dollars */}
                                    <button onClick={() => addToCart(product)}>Add to Cart</button>
                                </div>
                            ))
                        ) : (
                            <p>Loading products or no products available...</p>
                        )}
                    </div>
                ) : (
                    // --- Checkout View ---
                    <div className="checkout-section">
                        <h2>Your Shopping Cart</h2>
                        {cart.length === 0 ? (
                            <p>Your cart is empty. Please add items to proceed to checkout.</p>
                        ) : (
                            <>
                                <ul className="cart-items">
                                    {cart.map(item => (
                                        <li key={item.id}>
                                            <span>{item.name} (x{item.quantity})</span>
                                            <span>${(item.price * item.quantity / 100).toFixed(2)}</span>
                                            <div className="cart-item-controls">
                                                <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)}>-</button>
                                                <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)}>+</button>
                                                <button onClick={() => removeFromCart(item.id)} className="remove-btn">Remove</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                <h3 className="cart-total">Total: ${getTotalCartPrice()}</h3>
                                <button onClick={handleStripeCheckoutRedirect} className="pay-button">
                                    Pay with Stripe
                                </button>
                            </>
                        )}
                    </div>
                )}
            </main>

            <footer>
                <p>&copy; {new Date().getFullYear()} My Awesome Store</p>
            </footer>
        </div>
    );
}

export default App;