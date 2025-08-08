import React from 'react';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-brand">
                    <p>&copy; {currentYear} GitPulse. All Rights Reserved.</p>
                </div>
                <div className="footer-links">
                    <a href="https://github.com/pankajj48/GitPulse.git" className="footer-link" target="_blank" rel="noopener noreferrer">
                        About
                    </a>
                    <a href="https://my-portfolio-dlfq.onrender.com/" className="footer-link" target="_blank" rel="noopener noreferrer">
                        Contact
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;