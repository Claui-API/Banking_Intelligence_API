// src/components/Layout/Footer.js
// Footer.js
import React from 'react';
import { Container } from 'react-bootstrap';

const Footer = () => {
  return (
    <footer className="py-3">
      <Container>
        <p className="text-white text-center mb-0">
          &copy; {new Date().getFullYear()} VIVY TECH USA INC. All rights reserved.
        </p>
      </Container>
    </footer>
  );
};

export default Footer;