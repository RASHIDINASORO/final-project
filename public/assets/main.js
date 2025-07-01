// Wait for the DOM to load
document.addEventListener("DOMContentLoaded", () => {
    // Handle signup form submission
    const signupForm = document.getElementById("signupForm");
    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            // Get form data
            const fullName = document.getElementById("fullName").value.trim();
            const phone = document.getElementById("phone").value.trim();
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value.trim();

            // Send data to the server
            try {
                const response = await fetch("http://localhost:3000/signup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fullName, phone, email, password }),
                });

                const result = await response.json();

                // Display success or error message
                const messageDiv = document.getElementById("message");
                if (response.ok) {
                    messageDiv.textContent = "You are registered! Now login.";
                    messageDiv.style.color = "green";

                    // Clear the form
                    signupForm.reset();
                } else {
                    messageDiv.textContent = result.message || "An error occurred.";
                    messageDiv.style.color = "red";
                }
            } catch (error) {
                console.error("Error:", error);
                const messageDiv = document.getElementById("message");
                messageDiv.textContent = "An error occurred. Please try again.";
                messageDiv.style.color = "red";
            }
        });
    }

    // Handle login form submission
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            // Get form data
            const email = document.getElementById("username").value.trim();
            const password = document.getElementById("password").value.trim();
            const errorDiv = document.getElementById("loginError");

            // Clear previous error
            errorDiv.textContent = "";

            try {
                const response = await fetch("http://localhost:3000/index", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                });

                const result = await response.json();

                if (response.ok) {
                    // Store user information in localStorage
                    localStorage.setItem('user', JSON.stringify({
                        username: result.user.username,
                        phone: result.user.phone
                    }));
                    // Redirect to home.html on successful login
                    window.location.href = "home.html";
                } else {
                    // Display custom error message from server
                    errorDiv.textContent = result.message || "Invalid credentials. Please try again.";
                }
            } catch (error) {
                console.error("Error:", error);
                errorDiv.textContent = "A server error occurred. Please try again.";
            }
        });
    }

    // Handle navbar navigation
    setupNavbar();

    // Handle chat input
    setupChatInput();

    // Fetch success stories
    fetchSuccessStories();
});

document.getElementById('recoverForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const email = document.getElementById('recoverEmail').value.trim();
    alert(`If an account exists for ${email}, recovery instructions have been sent.`);
    // Optionally, send this email to  backend for processing.
});

// Function to validate the signup form
function validateSignupForm(fullName, phone, email, password) {
    if (!fullName || !phone || !email || !password) {
        alert("All fields are required.");
        return false;
    }
    if (!/^\d{10}$/.test(phone)) {
        alert("Phone number must be 10 digits.");
        return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
        alert("Invalid email format.");
        return false;
    }
    if (password.length < 6) {
        alert("Password must be at least 6 characters long.");
        return false;
    }
    return true;
}

// Function to validate the login form
function validateLoginForm(username, password) {
    if (!username || !password) {
        alert("Both username and password are required.");
        return false;
    }
    return true;
}

// Function to set up the navbar
function setupNavbar() {
    const navbarLinks = document.querySelectorAll(".navbar a");
    navbarLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const target = e.target.closest("a").getAttribute("href");
            window.location.href = target; // Navigate to the target page
        });
    });
}

// Function to handle chat input
function setupChatInput() {
    const chatInput = document.getElementById("chatInput");
    const sendMessageBtn = document.getElementById("sendMessageBtn");

    if (chatInput && sendMessageBtn) {
        sendMessageBtn.addEventListener("click", () => {
            const message = chatInput.value.trim();
            if (message) {
                addChatMessage("user", message);
                chatInput.value = ""; // Clear the input
            }
        });
    }
}

// Function to add a chat message
function addChatMessage(sender, message) {
    const chatContainer = document.querySelector(".chat-container");
    if (chatContainer) {
        const chatDiv = document.createElement("div");
        chatDiv.classList.add("chat", sender);
        chatDiv.innerHTML = `<div class="message">${message}</div>`;
        chatContainer.appendChild(chatDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight; // Scroll to the bottom
    }
}

// Function to fetch success stories
function fetchSuccessStories() {
    fetch('http://localhost:3000/success-stories')
        .then(response => response.json())
        .then(data => console.log(data))
        .catch(error => console.error('Error:', error));
}

// Store user information in localStorage (for demonstration purposes)
localStorage.setItem('user', JSON.stringify({
    username: 'Yusuph Paul', // Replace with actual username
    avatar: 'icons/general profile.jpeg' // Replace with actual avatar path if available
}));

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            const errorDiv = document.getElementById('loginError');

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    errorDiv.textContent = data.error || 'An unknown error occurred.';
                } else {
                    errorDiv.textContent = '';
                    window.location.href = 'home.html';
                }
            } catch (err) {
                errorDiv.textContent = 'Server error. Please try again later.';
            }
        });
    }

    // Reset forms after submit
    document.querySelectorAll("form").forEach(function(form) {
        form.addEventListener("submit", function(e) {
            setTimeout(() => form.reset(), 100);
        });
    });
});

const sellerName = p.seller_name ? p.seller_name : "Unknown";
const sellerPhone = p.seller_phone ? p.seller_phone : "Not provided";
const productHTML = `
    <div class="product" style="position:relative;">
        ${timeBadge}
        <img src="${p.image}" alt="${p.name}">
        <div class="name">${p.name}</div>
        <div class="price">${p.price} Tsh</div>
        <button class="cart-btn" onclick="showSellerModal('${sellerName.replace(/'/g,"&#39;")}', '${sellerPhone.replace(/'/g,"&#39;")}')">Add to Cart</button>
    </div>
`;