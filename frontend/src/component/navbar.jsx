import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
    return (
        <nav className="navbar">
            <div className="navbar-container">
                <div className="navbar-brand">
                    <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
                        <img src="/homelogo.png" alt="logo" width={40} height={40}/>
                    </Link>
                </div>
                <div className="navbar-links">
                    <a className="nav-link" href="https://github.com/pankajj48/GitPulse.git">About</a>
                    <a className="nav-link" href="#features">Features</a>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
