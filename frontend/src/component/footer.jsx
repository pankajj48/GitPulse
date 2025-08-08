import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        <p className="footer-copyright">
          &copy; {currentYear} Repo Visualizer AI. All Rights Reserved.
        </p>
        <div className="footer-links">
  
          <a href="https://github.com/pankajj48/GitPulse.git" className="footer-link">
            About
          </a>
          <a href="https://my-portfolio-dlfq.onrender.com/" className="footer-link">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;