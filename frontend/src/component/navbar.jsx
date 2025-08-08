import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
    return (
        <nav className="navbar">
            <div className="navbar-container">
                <div className="navbar-brand">
                    <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
                        <img src="./src/assets/navlogo.png" alt="navlogo" />
                    </Link>
                </div>
                <div className="navbar-links">
                    <a className="nav-link" href="#about">About</a>
                    <a className="nav-link" href="#features">Features</a>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
