// src/components/HomePage.js
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Container, Row, Col, Button, Card, Image } from 'react-bootstrap';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import CountUp from 'react-countup';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';
import './HomePage.css';

// Animation variants for different elements
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6 }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const scaleIn = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: { duration: 0.5 }
  }
};

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  const controls = useAnimation();
  const [scrollY, setScrollY] = useState(0);
  
  // References for animations
  const [featuresRef, featuresInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [howItWorksRef, howItWorksInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [ctaRef, ctaInView] = useInView({ threshold: 0.5, triggerOnce: true });
  
  // Initialize particles
  const particlesInit = async (main) => {
    await loadFull(main);
  };
  
  // Handle scroll effects
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Trigger animations when sections come into view
  useEffect(() => {
    if (featuresInView) {
      controls.start('visible');
    }
  }, [controls, featuresInView]);
  
  return (
    <div className="home-page-container">
      {/* Particles Background */}
      <Particles
        id="tsparticles"
        init={particlesInit}
        options={{
          fullScreen: {
            enable: true,
            zIndex: -1
          },
          particles: {
            number: {
              value: 40,
              density: {
                enable: true,
                value_area: 800
              }
            },
            color: {
              value: "#28a745"
            },
            opacity: {
              value: 0.3,
              random: true
            },
            size: {
              value: 3,
              random: true
            },
            line_linked: {
              enable: true,
              distance: 150,
              color: "#28a745",
              opacity: 0.2,
              width: 1
            },
            move: {
              enable: true,
              speed: 1,
              direction: "none",
              random: true,
              straight: false,
              out_mode: "out",
              bounce: false
            }
          },
          interactivity: {
            detect_on: "canvas",
            events: {
              onhover: {
                enable: true,
                mode: "grab"
              },
              onclick: {
                enable: true,
                mode: "push"
              }
            },
            modes: {
              grab: {
                distance: 140,
                line_linked: {
                  opacity: 0.5
                }
              },
              push: {
                particles_nb: 3
              }
            }
          },
          retina_detect: true
        }}
      />

      {/* Header section with motion */}
      <motion.div 
        className="text-center py-4"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <Container>
          <motion.h1 
            className="text-white mb-0" 
            style={{ 
              fontSize: '3.5rem', 
              fontWeight: '900', 
              letterSpacing: '-0.03em',
              fontFamily: "'Inter Display', 'Inter', sans-serif",
              textTransform: 'none'
            }}
            animate={{ 
              textShadow: [
                "0 0 5px rgba(40, 167, 69, 0.3)",
                "0 0 15px rgba(40, 167, 69, 0.5)",
                "0 0 5px rgba(40, 167, 69, 0.3)"
              ]
            }}
            transition={{ 
              duration: 3, 
              ease: "easeInOut", 
              repeat: Infinity 
            }}
          >
            Banking Intelligence API
          </motion.h1>
        </Container>
      </motion.div>

      {/* App Overview section */}
      <Container className="py-4 text-center">
        <motion.div 
          className="mb-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <motion.div 
            className="mx-auto mb-5" 
            style={{ 
              maxWidth: '600px', 
              background: 'linear-gradient(90deg, #00c6ff, #ff00de)', 
              padding: '2px',
              borderRadius: '4px'
            }}
            whileHover={{ 
              boxShadow: "0 0 25px rgba(0, 198, 255, 0.5)"
            }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ background: '#222', padding: '15px' }}>
              {/* YouTube video embed */}
              <div className="ratio ratio-16x9" style={{ maxWidth: '100%' }}>
                <iframe
                  src="https://www.youtube.com/embed/hMO6E50YSXU?si=KLrgifAyC5Pb1uCC"
                  title="Banking Intelligence Demo"
                  allowFullScreen
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                ></iframe>
              </div>
            </div>
          </motion.div>
          
          <motion.p 
            className="text-white mx-auto" 
            style={{ maxWidth: '600px', fontSize: '1.5rem' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            Add AI-powered financial insights to your banking application with the CLAU Banking Intelligence API
          </motion.p>
          
          <motion.div 
            className="d-flex justify-content-center gap-3 mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            {isAuthenticated ? (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link to="/dashboard" className="btn btn-success btn-lg">
                  Go to API Dashboard
                </Link>
              </motion.div>
            ) : (
              <>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link to="/register" className="btn btn-success btn-lg">
                    Get Your API Key
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link to="/docs" className="btn btn-outline-success btn-lg">
                    View Documentation
                  </Link>
                </motion.div>
              </>
            )}
          </motion.div>
        </motion.div>
      </Container>

      {/* Stats Counter Section */}
      <Container className="py-4">
        <motion.div 
          className="text-center stats-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          <Row>
            <Col md={4}>
              <div className="stat-card">
                <div className="stat-icon text-success">
                  <i className="bi bi-graph-up"></i>
                </div>
                <h2 className="text-white">
                  <CountUp end={98} suffix="%" duration={2.5} />
                </h2>
                <p className="text-light">API Uptime</p>
              </div>
            </Col>
            <Col md={4}>
              <div className="stat-card">
                <div className="stat-icon text-success">
                  <i className="bi bi-people"></i>
                </div>
                <h2 className="text-white">
                  <CountUp end={1250} duration={3} />+
                </h2>
                <p className="text-light">Active Developers</p>
              </div>
            </Col>
            <Col md={4}>
              <div className="stat-card">
                <div className="stat-icon text-success">
                  <i className="bi bi-clock-history"></i>
                </div>
                <h2 className="text-white">
                  <CountUp end={500} suffix="ms" duration={2} />
                </h2>
                <p className="text-light">Average Response Time</p>
              </div>
            </Col>
          </Row>
        </motion.div>
      </Container>

      {/* Features section */}
      <Container className="py-5">
        <motion.div
          ref={featuresRef}
          variants={staggerContainer}
          initial="hidden"
          animate={featuresInView ? "visible" : "hidden"}
        >
          <motion.h2 
            className="text-success text-center mb-5"
            variants={fadeIn}
          >
            Key Features
          </motion.h2>
          
          <Row className="g-4">
            <Col md={4}>
              <motion.div variants={scaleIn}>
                <Card className="h-100 text-white border-secondary feature-card">
                  <Card.Body>
                    <div className="text-success mb-3 feature-icon">
                      <i className="bi bi-graph-up-arrow" style={{ fontSize: '2rem' }}></i>
                    </div>
                    <Card.Title>Contextualized Insights</Card.Title>
                    <Card.Text>
                      Transform raw financial data into personalized insights that help your users make better financial decisions.
                    </Card.Text>
                  </Card.Body>
                </Card>
              </motion.div>
            </Col>
            
            <Col md={4}>
              <motion.div variants={scaleIn}>
                <Card className="h-100 text-white border-secondary feature-card">
                  <Card.Body>
                    <div className="text-success mb-3 feature-icon">
                      <i className="bi bi-robot" style={{ fontSize: '2rem' }}></i>
                    </div>
                    <Card.Title>AI-Powered Analysis</Card.Title>
                    <Card.Text>
                      CLAU's advanced AI analyzes spending patterns, identifies savings opportunities, and provides smart recommendations.
                    </Card.Text>
                  </Card.Body>
                </Card>
              </motion.div>
            </Col>
            
            <Col md={4}>
              <motion.div variants={scaleIn}>
                <Card className="h-100 text-white border-secondary feature-card">
                  <Card.Body>
                    <div className="text-success mb-3 feature-icon">
                      <i className="bi bi-code-square" style={{ fontSize: '2rem' }}></i>
                    </div>
                    <Card.Title>Simple Integration</Card.Title>
                    <Card.Text>
                      Easy-to-use REST API with comprehensive documentation. Integrate with your app in minutes, not days.
                    </Card.Text>
                  </Card.Body>
                </Card>
              </motion.div>
            </Col>
          </Row>
        </motion.div>
      </Container>

      {/* How it works section */}
      <motion.div
        ref={howItWorksRef}
        initial="hidden"
        animate={howItWorksInView ? "visible" : "hidden"}
        variants={staggerContainer}
        className="py-5 rounded my-5"
      >
        <Container>
          <motion.h2 
            className="text-success text-center mb-5"
            variants={fadeIn}
          >
            How It Works
          </motion.h2>
          
          <motion.div variants={fadeIn}>
            <Row className="align-items-center mb-5">
              <Col md={6}>
                <motion.div 
                  className="bg-success p-4 rounded mb-3 mb-md-0"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-white">1. Register for an API Key</h4>
                  <p className="text-light">Create an account and get your API key to integrate our services.</p>
                </motion.div>
              </Col>
              <Col md={6}>
                <motion.pre 
                  className="bg-black p-3 rounded text-white code-block"
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <code>
                  # Step 1: Create an account and get your API key
                  API_KEY = "your_api_key_here"
                  </code>
                </motion.pre>
              </Col>
            </Row>
          </motion.div>
          
          <motion.div variants={fadeIn}>
            <Row className="align-items-center mb-5">
              <Col md={{span: 6, order: 'last'}}>
                <motion.div 
                  className="bg-success p-4 rounded mb-3 mb-md-0"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-white">2. Connect User Data</h4>
                  <p className="text-light">Send financial data to our API via secure endpoints.</p>
                </motion.div>
              </Col>
              <Col md={6}>
                <motion.pre 
                  className="bg-black p-3 rounded text-white code-block"
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <code>
                  # Step 2: Send financial data
                  user_data = {"{"}
                    "accounts": [...],
                    "transactions": [...]
                  {"}"}
                  </code>
                </motion.pre>
              </Col>
            </Row>
          </motion.div>
          
          <motion.div variants={fadeIn}>
            <Row className="align-items-center">
              <Col md={6}>
                <motion.div 
                  className="bg-success p-4 rounded mb-3 mb-md-0"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-white">3. Get Personalized Insights</h4>
                  <p className="text-light">Receive AI-powered financial insights to display in your app.</p>
                </motion.div>
              </Col>
              <Col md={6}>
                <motion.pre 
                  className="bg-black p-3 rounded text-white code-block"
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                >
                  <code>
                  # Step 3: Request insights
                  insights = api.get_insights(
                    query="How can I save money?",
                    user_data=user_data
                  )
                  </code>
                </motion.pre>
              </Col>
            </Row>
          </motion.div>
        </Container>
      </motion.div>

      {/* Call to action */}
      <motion.div
        ref={ctaRef}
        initial={{ opacity: 0, y: 50 }}
        animate={ctaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.8 }}
        className="py-5 cta-section"
      >
        <Container className="text-center">
          <motion.h2 
            className="text-success mb-4"
            animate={ctaInView ? 
              { scale: [1, 1.05, 1], textShadow: "0 0 8px rgba(40, 167, 69, 0.5)" } : {}
            }
            transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
          >
            Ready to enhance your banking app?
          </motion.h2>
          <motion.p 
            className="text-light mb-4"
            animate={ctaInView ? { opacity: [0.7, 1, 0.7] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Join fintech companies already using our API to provide personalized financial guidance
          </motion.p>
          <motion.div
            whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(40, 167, 69, 0.5)" }}
            whileTap={{ scale: 0.95 }}
          >
            <Link to="/register" className="btn btn-success btn-lg">
              Get Started Today
            </Link>
          </motion.div>
        </Container>
      </motion.div>
    </div>
  );
};

export default HomePage;