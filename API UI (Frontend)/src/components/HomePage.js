// src/components/HomePage.js
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Container, Row, Col, Button, Card, Image } from 'react-bootstrap';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import CountUp from 'react-countup';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';
import useDelayedAnimation, { getStaggeredDelay } from '../hooks/useDelayedAnimation';
import './HomePage.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CodeBlock = ({ code, language = 'javascript' }) => (
  <SyntaxHighlighter
    language={language}
    style={oneDark}
    customStyle={{
      fontSize: '0.9rem',
      background: 'transparent',
    }}
    codeTagProps={{
      style: {
        background: 'transparent'
      }
    }}
  >
    {code}
  </SyntaxHighlighter>
);

const step1 = `
  Step 1: Create an account and get your API key
  API_KEY = "your_api_key_here"
  `;

const step2 = `Step 2: Send financial data
  user_data = {"{"}
  "accounts": [...],
  "transactions": [...]
 {"}"}
 `;

const step3 = `Step 3: Request insights
  insights = api.get_insights(
    query="How can I save money?",
    user_data=user_data
  )`;

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.3,
      staggerChildren: 0.2
    }
  }
};

const scaleIn = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.7, ease: "easeOut" }
  }
};

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  const controls = useAnimation();
  const [scrollY, setScrollY] = useState(0);
  const [videoFade, setVideoFade] = useState("hidden");
  const videoRef = useRef(null);

  // Use our custom hook to delay animations until page is loaded
  const animationsActive = useDelayedAnimation({
    initialDelay: 200, // Increased delay before starting animations
    disableOnMobile: false // Set to true to disable animations on mobile
  });

  // References for animations
  const [featuresRef, featuresInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [howItWorksRef, howItWorksInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [ctaRef, ctaInView] = useInView({ threshold: 0.5, triggerOnce: true });
  const [videoSectionRef, videoSectionInView] = useInView({
    threshold: 0.1,
    triggerOnce: false,
    rootMargin: "-100px 0px" // Slightly earlier detection
  });

  // Initialize particles with a ref to ensure it only loads once
  const particlesInitialized = useRef(false);
  const particlesInit = async (main) => {
    if (!particlesInitialized.current) {
      await loadFull(main);
      particlesInitialized.current = true;
    }
  };

  // Video fade in/out effect when the video plays
  useEffect(() => {
    if (videoRef.current && animationsActive) {
      // Add event listeners for video fade effects
      const videoElement = videoRef.current;

      // Fade in at start
      videoElement.addEventListener('play', function () {
        // If it's the first play or a new loop - fade in
        videoElement.classList.remove('video-fade-out');
        videoElement.classList.add('video-fade-in');
      });

      // Fade out before the end
      videoElement.addEventListener('timeupdate', function () {
        // When video is near the end (2 seconds before), start the fade out
        if (this.duration > 0 && this.currentTime > this.duration - 2) {
          videoElement.classList.remove('video-fade-in');
          videoElement.classList.add('video-fade-out');
        }
      });

      return () => {
        // Clean up event listeners
        videoElement.removeEventListener('play', () => { });
        videoElement.removeEventListener('timeupdate', () => { });
      };
    }
  }, [videoRef, animationsActive]);

  // Trigger animations when sections come into view
  useEffect(() => {
    if (featuresInView && animationsActive) {
      controls.start('visible');
    }
  }, [controls, featuresInView, animationsActive]);

  // Video fade in/out effect
  useEffect(() => {
    if (videoSectionInView) {
      // Fade in when in view
      setVideoFade("visible");
    } else {
      // Fade out when out of view
      setVideoFade("hidden");
    }
  }, [videoSectionInView]);

  // Preload video when animations are active
  useEffect(() => {
    if (animationsActive && videoRef.current) {
      videoRef.current.load();
    }
  }, [animationsActive]);

  return (
    <div className="home-page-container">
      {/* Particles Background - only show after animations are active */}
      {animationsActive && (
        <Particles
          id="tsparticles"
          init={particlesInit}
          options={{
            fullScreen: {
              enable: false,
              zIndex: -1
            },
            particles: {
              number: {
                value: 30, // Reduced from original for better performance
                density: {
                  enable: true,
                  value_area: 1000
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
                speed: 0.8, // Slower speed for better performance
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
                  particles_nb: 2 // Reduced for better performance
                }
              }
            },
            retina_detect: true
          }}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            zIndex: -1
          }}
        />
      )}

      {/* Header section with motion - only animate after page load */}
      <AnimatePresence>
        {animationsActive && (
          <motion.div
            className="text-center py-4"
            initial={{ opacity: 0, y: -25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
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
                  repeat: Infinity,
                  delay: 1.2 // Delay the glow effect
                }}
              >
                Banking Intelligence API
              </motion.h1>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-width background video section */}
      <div
        ref={videoSectionRef}
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          marginBottom: '2rem'
        }}
      >
        {/* Background Video - Full width */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0
        }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.4,
            }}
            className="background-video"
          >
            <source src="videos/Amazon_Rainforest_Video_for_App.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Content overlay with YouTube video */}
        <Container className="py-5 text-center" style={{ position: 'relative', zIndex: 1 }}>
          <AnimatePresence>
            {animationsActive && (
              <motion.div
                className="mb-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }} // Increased delay
              >
                <motion.div
                  className="mx-auto mb-5"
                  style={{
                    maxWidth: '700px',
                    background: 'linear-gradient(90deg, #00c6ff, #ff00de)',
                    padding: '2px',
                    borderRadius: '4px',
                    position: 'relative',
                  }}
                  whileHover={{
                    boxShadow: "0 0 25px rgba(0, 198, 255, 0.5)"
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <div style={{
                    background: 'rgba(20, 20, 20, 0.85)', // Darker semi-transparent background
                    padding: '15px',
                    borderRadius: '2px'
                  }}>
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
                  style={{ maxWidth: '700px', fontSize: '1.5rem', textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.9 }} // Increased delay
                >
                  Add AI-powered financial insights to your banking application with the CLAU Banking Intelligence API
                </motion.p>

                <motion.div
                  className="d-flex justify-content-center gap-3 mt-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.2 }} // Increased delay
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
            )}
          </AnimatePresence>
        </Container>
      </div> {/* End of full-width background video section */}

      {/* Stats Counter Section - only display counters after animations are active */}
      <Container className="py-4">
        <motion.div
          className="text-center stats-container"
          initial={{ opacity: 0 }}
          animate={animationsActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, delay: 1.4 }} // Additional delay
        >
          <Row>
            <Col md={4}>
              <div className="stat-card">
                <div className="stat-icon text-success">
                  <i className="bi bi-graph-up"></i>
                </div>
                <h2 className="text-white">
                  {animationsActive && <CountUp end={98} suffix="%" duration={2.5} delay={0.5} />}
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
                  {animationsActive && <CountUp end={50} duration={3} delay={0.7} />}+
                </h2>
                <p className="text-white">Beta Testing Now</p>
              </div>
            </Col>
            <Col md={4}>
              <div className="stat-card">
                <div className="stat-icon text-success">
                  <i className="bi bi-clock-history"></i>
                </div>
                <h2 className="text-white">
                  {animationsActive && <CountUp end={1500} suffix="ms" duration={2} delay={0.9} />}
                </h2>
                <p className="text-white">Average Response Time</p>
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
          animate={featuresInView && animationsActive ? "visible" : "hidden"}
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
        animate={howItWorksInView && animationsActive ? "visible" : "hidden"}
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
                  className="bg-success p-4 rounded mb-3 mb-md-0 w-100"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-white">1. Register for an API Key</h4>
                  <p className="text-black">Create an account and get your API key to integrate our services.</p>
                </motion.div>
              </Col>
              <Col md={6}>
                <motion.pre
                  className="bg-black p-4 rounded text-white code-block w-100"
                  initial={{ x: 50, opacity: 0 }}
                  animate={howItWorksInView && animationsActive ? { x: 0, opacity: 1 } : { x: 50, opacity: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <CodeBlock code={step1} language="javascript" />
                </motion.pre>
              </Col>
            </Row>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Row className="align-items-center mb-5">
              <Col md={{ span: 6, order: 'last' }}>
                <motion.div
                  className="bg-success p-4 rounded mb-3 mb-md-0 w-100"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-white">2. Connect User Data</h4>
                  <p className="text-black">Send financial data to our API via secure endpoints.</p>
                </motion.div>
              </Col>
              <Col md={6}>
                <motion.pre
                  className="bg-black p-3 rounded text-white code-block"
                  initial={{ x: -50, opacity: 0 }}
                  animate={howItWorksInView && animationsActive ? { x: 0, opacity: 1 } : { x: -50, opacity: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <CodeBlock code={step2} language="javascript" />
                </motion.pre>
              </Col>
            </Row>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Row className="align-items-center">
              <Col md={6}>
                <motion.div
                  className="bg-success p-4 rounded mb-3 mb-md-0 w-100"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-white">3. Get Personalized Insights</h4>
                  <p className="text-black">Receive AI-powered financial insights to display in your app.</p>
                </motion.div>
              </Col>
              <Col md={6}>
                <motion.pre
                  className="bg-black p-3 rounded text-white code-block"
                  initial={{ x: 50, opacity: 0 }}
                  animate={howItWorksInView && animationsActive ? { x: 0, opacity: 1 } : { x: 50, opacity: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                >
                  <CodeBlock code={step3} language="javascript" />
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
        animate={ctaInView && animationsActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.8 }}
        className="py-5 cta-section"
      >
        <Container className="text-center">
          <motion.h2
            className="text-success mb-4"
            animate={ctaInView && animationsActive ?
              { scale: [1, 1.05, 1], textShadow: "0 0 8px rgba(40, 167, 69, 0.5)" } : {}
            }
            transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
          >
            Ready to enhance your banking app?
          </motion.h2>
          <motion.p
            className="text-light mb-4"
            animate={ctaInView && animationsActive ? { opacity: [0.7, 1, 0.7] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Join fintech companies already using our API to provide personalized financial guidance
          </motion.p>
          <motion.div
            className="d-inline-block p-2 rounded"
            whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(40, 167, 69, 0.5)" }}
            whileTap={{ scale: 0.95 }}
          >
            <Link to={isAuthenticated ? "/dashboard" : "/register"} className="btn btn-success btn-lg">
              {isAuthenticated ? "Go to Dashboard" : "Get Started Today"}
            </Link>
          </motion.div>
        </Container>
      </motion.div>
    </div>
  );
};

export default HomePage;