import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
    // State to manage whether the mobile menu is open or closed
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        // Add a class to the nav when the menu is open to trigger CSS changes
        <nav className={`navbar ${isMenuOpen ? 'nav-open' : ''}`}>
            <div className="navbar-container">
                <div className="navbar-brand">
                    <Link to="/" onClick={() => setIsMenuOpen(false)}>
                        <img src="/navlogo.png" alt="GitPulse Logo" />
                    </Link>
                </div>

                {/* The navigation links menu */}
                <div className="navbar-links">
                    <a className="nav-link" href="https://github.com/pankajj48/GitPulse.git" target="_blank" rel="noopener noreferrer">About</a>
                    <a className="nav-link" href="#features" onClick={() => setIsMenuOpen(false)}>Features</a>
                </div>

                {/* The hamburger button - only visible on mobile */}
                <button 
                    className="hamburger-menu" 
                    onClick={() => setIsMenuOpen(!isMenuOpen)} 
                    aria-label="Toggle navigation"
                >
                    <span className="hamburger-bar"></span>
                    <span className="hamburger-bar"></span>
                    <span className="hamburger-bar"></span>
                </button>
            </div>
        </nav>
    );
};

export default Navbar;