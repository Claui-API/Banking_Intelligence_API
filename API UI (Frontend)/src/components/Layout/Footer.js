// src/components/Layout/Footer.js
import React from 'react';
import { Container } from 'react-bootstrap';

const Footer = () => {
  return (
    <footer className="py-3">
      <Container>
        <p className="text-secondary text-center mb-0">
          &copy; {new Date().getFullYear()} <a href="https://vivytech.com" className="text-secondary text-decoration-none">VIVY TECH USA INC.</a> All rights reserved.
        </p>
      </Container>
    </footer>
  );
};

export default Footer;