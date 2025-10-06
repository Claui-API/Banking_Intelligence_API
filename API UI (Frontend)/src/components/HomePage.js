import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Container, Row, Col, Button, Card, Image, Form } from 'react-bootstrap';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import CountUp from 'react-countup';
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
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const timeoutRef = useRef(null);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const animationsActive = useDelayedAnimation({
    initialDelay: 200,
    disableOnMobile: false
  });

  // References for animations
  const [featuresRef, featuresInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [howItWorksRef, howItWorksInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [ctaRef, ctaInView] = useInView({ threshold: 0.5, triggerOnce: true });
  const [videoSectionRef, videoSectionInView] = useInView({
    threshold: 0.1,
    triggerOnce: false,
    rootMargin: "-100px 0px"
  });
  const [aiSectionRef, aiSectionInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [commandSectionRef, commandSectionInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [targetAudienceRef, targetAudienceInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [resultsRef, resultsInView] = useInView({ threshold: 0.2, triggerOnce: true });

  // Handle contact form submission
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('');
    setErrorMessage(''); // Clear previous error message

    try {
      // Get the API base URL from environment or use default
      const API_URL = process.env.REACT_APP_API_URL || 'https://bankingintelligenceapi.com';

      // Fixed URL - remove the duplicate /api/
      const response = await fetch(`${API_URL}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add any required authentication headers if needed
          // 'Authorization': `Bearer ${apiKey}`, // If you need auth
        },
        body: JSON.stringify({
          name: contactForm.name,
          email: contactForm.email,
          company: contactForm.company,
          message: contactForm.message
        }),
      });

      // Handle different response scenarios
      if (response.ok) {
        const responseData = await response.json();
        setSubmitStatus('success');
        setContactForm({ name: '', email: '', company: '', message: '' });
        setErrorMessage('');
      } else {
        // Try to get error message from response
        let responseData;
        try {
          responseData = await response.json();
        } catch (jsonError) {
          // If response isn't JSON, use status text
          responseData = { error: response.statusText || 'Unknown error occurred' };
        }

        // Set specific error message based on status code
        if (response.status === 401) {
          setErrorMessage('Authentication required. Please check your API configuration.');
        } else if (response.status === 404) {
          setErrorMessage('Contact endpoint not found. Please check the API URL.');
        } else if (response.status === 500) {
          setErrorMessage('Server error. Please try again later.');
        } else {
          setErrorMessage(responseData.error || `Error: ${response.status} ${response.statusText}`);
        }

        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error sending contact form:', error);

      // Set user-friendly error message based on error type
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setErrorMessage('Unable to connect to server. Please check your internet connection.');
      } else if (error.name === 'AbortError') {
        setErrorMessage('Request timed out. Please try again.');
      } else {
        setErrorMessage('An unexpected error occurred. Please try again or contact us directly.');
      }

      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 350 && width <= 470) {
        document.body.classList.add('narrow-screen-fix');
      } else {
        document.body.classList.remove('narrow-screen-fix');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.body.classList.remove('narrow-screen-fix');
    };
  }, []);

  useEffect(() => {
    if (animationsActive) {
      timeoutRef.current = setTimeout(() => {
        if (!contentVisible) {
          setVideoLoaded(true);
          setContentVisible(true);
        }
      }, 3000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [animationsActive, contentVisible]);

  useEffect(() => {
    if (videoRef.current && animationsActive) {
      const videoElement = videoRef.current;

      const handleVideoLoaded = () => {
        setVideoLoaded(true);
        setContentVisible(true);
        videoElement.loop = true;
      };

      const handleMetadataLoaded = () => {
        if (videoElement.readyState >= 1) {
          setTimeout(() => {
            setVideoLoaded(true);
            setContentVisible(true);
          }, 100);
        }
      };

      const handlePlay = () => {
        videoElement.classList.remove('video-fade-out');
        videoElement.classList.add('video-fade-in');
      };

      const handleEnded = () => {
        videoElement.currentTime = 0;
        videoElement.play().catch(e => console.log('Video autoplay prevented by browser'));
      };

      videoElement.addEventListener('loadedmetadata', handleMetadataLoaded);
      videoElement.addEventListener('loadeddata', handleVideoLoaded);
      videoElement.addEventListener('play', handlePlay);
      videoElement.addEventListener('ended', handleEnded);

      return () => {
        videoElement.removeEventListener('loadedmetadata', handleMetadataLoaded);
        videoElement.removeEventListener('loadeddata', handleVideoLoaded);
        videoElement.removeEventListener('play', handlePlay);
        videoElement.removeEventListener('ended', handleEnded);
      };
    }
  }, [videoRef, animationsActive]);

  useEffect(() => {
    if (featuresInView && animationsActive) {
      controls.start('visible');
    }
  }, [controls, featuresInView, animationsActive]);

  useEffect(() => {
    if (videoSectionInView) {
      setVideoFade("visible");
    } else {
      setVideoFade("hidden");
    }
  }, [videoSectionInView]);

  useEffect(() => {
    if (animationsActive && videoRef.current) {
      videoRef.current.preload = "auto";
      videoRef.current.playsInline = true;
      videoRef.current.muted = true;
      videoRef.current.loop = true;
      videoRef.current.load();
      videoRef.current.play().catch(e => {
        console.log('Video autoplay prevented by browser, will try again when user interacts');
      });

      if (videoRef.current.readyState >= 1) {
        setTimeout(() => {
          setVideoLoaded(true);
          setContentVisible(true);
        }, 100);
      }
    }
  }, [animationsActive]);

  return (
    <div className="home-page-container">
      {/* Hero Section with Video */}
      <div
        ref={videoSectionRef}
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          marginBottom: '2rem'
        }}
      >
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: videoLoaded ? 0.4 : 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            className="background-video"
          >
            <source src="videos/Amazon_Rainforest_Video_for_App.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </motion.div>

        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#000000',
            zIndex: videoLoaded ? 0 : 1
          }}
          initial={{ opacity: 1 }}
          animate={{ opacity: videoLoaded ? 0 : 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />

        <AnimatePresence>
          {animationsActive && contentVisible && (
            <motion.div
              className="text-center py-4"
              initial={{ opacity: 0, y: -25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <Container>
                <motion.h1
                  className="text-white mb-0 mobile-responsive-title"
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
                    delay: 0.8
                  }}
                >
                  Banking Intelligence API
                </motion.h1>
              </Container>
            </motion.div>
          )}
        </AnimatePresence>

        <Container className="py-5 text-center" style={{ position: 'relative', zIndex: 1 }}>
          <AnimatePresence>
            {animationsActive && contentVisible && (
              <motion.div
                className="mb-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <motion.div
                  className="mx-auto mb-5 mobile-video-container"
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
                    background: 'rgba(20, 20, 20, 0.85)',
                    padding: '15px',
                    borderRadius: '2px'
                  }}>
                    <div className="narrow-screen-container">
                      <div className="ratio ratio-16x9 mobile-responsive-video">
                        <iframe
                          src="https://www.youtube.com/embed/hMO6E50YSXU?si=KLrgifAyC5Pb1uCC"
                          title="Banking Intelligence Demo"
                          allowFullScreen
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        ></iframe>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.p
                  className="text-white mx-auto"
                  style={{ maxWidth: '700px', fontSize: '1.5rem', textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  The easiest way to modernize your bank with AI-powered financial insights
                </motion.p>

                <motion.div
                  className="d-flex justify-content-center gap-3 mt-4 mobile-button-container"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 }}
                >
                  {isAuthenticated ? (
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-100 mobile-btn-wrapper">
                      <Link to="/dashboard" className="btn btn-success btn-lg mobile-action-btn">
                        Go to API Dashboard
                      </Link>
                    </motion.div>
                  ) : (
                    <>
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="mobile-btn-wrapper">
                        <Link to="/register" className="btn btn-success btn-lg mobile-action-btn">
                          Get Your API Key
                        </Link>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="mobile-btn-wrapper">
                        <Link to="/docs" className="btn btn-outline-success btn-lg mobile-action-btn">
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
      </div>

      {/* Stats Counter Section */}
      <Container className="py-4">
        <motion.div
          className="text-center stats-container"
          initial={{ opacity: 0 }}
          animate={animationsActive && contentVisible ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
        >
          <Row className="mobile-stats-row">
            <Col md={4} sm={6} className="mobile-stat-col">
              <div className="stat-card">
                <div className="stat-icon text-success">
                  <i className="bi bi-graph-up"></i>
                </div>
                <h2 className="text-white mobile-stat-number">
                  {animationsActive && <CountUp end={98} suffix="%" duration={2.5} delay={0.2} />}
                </h2>
                <p className="text-light mobile-stat-label">API Uptime</p>
              </div>
            </Col>
            <Col md={4} sm={6} className="mobile-stat-col">
              <div className="stat-card">
                <div className="stat-icon text-success">
                  <i className="bi bi-people"></i>
                </div>
                <h2 className="text-white mobile-stat-number">
                  {animationsActive && <CountUp end={50} duration={3} delay={0.3} />}+
                </h2>
                <p className="text-white mobile-stat-label">Beta Testing Now</p>
              </div>
            </Col>
            <Col md={4} sm={12} className="mobile-stat-col">
              <div className="stat-card">
                <div className="stat-icon text-success">
                  <i className="bi bi-clock-history"></i>
                </div>
                <h2 className="text-white mobile-stat-number">
                  {animationsActive && <CountUp end={1500} suffix="ms" duration={2} delay={0.4} />}
                </h2>
                <p className="text-white mobile-stat-label">Average Response Time</p>
              </div>
            </Col>
          </Row>
        </motion.div>
      </Container>

      {/* Banking Intelligence AI Section */}
      <Container className="py-5">
        <motion.div
          ref={aiSectionRef}
          initial="hidden"
          animate={aiSectionInView && animationsActive ? "visible" : "hidden"}
          variants={staggerContainer}
          className="ai-section"
        >
          <motion.div
            className="text-center mb-5"
            variants={fadeIn}
          >
            <h2 className="text-success mb-4">Banking Intelligence AI</h2>
            <p className="text-white mx-auto" style={{ maxWidth: '800px' }}>
              Banking Intelligence is an API service that provides any financial institution with
              access to personalized AI chatbots trained with real financial data. No more generic
              chatbots or time-wasting processes.
            </p>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Row className="g-4 mobile-features-row">
              <Col md={4} sm={12} className="mobile-feature-col">
                <motion.div variants={scaleIn}>
                  <Card className="h-100 text-white border-secondary feature-card mobile-feature-card">
                    <Card.Body>
                      <div className="text-success mb-3 feature-icon">
                        <i className="bi bi-shield-check" style={{ fontSize: '2rem' }}></i>
                      </div>
                      <Card.Title>Trained on Real Financial Data</Card.Title>
                      <Card.Text>
                        Our AI is trained specifically on financial data patterns, providing accurate
                        and relevant insights for banking and financial services.
                      </Card.Text>
                    </Card.Body>
                  </Card>
                </motion.div>
              </Col>

              <Col md={4} sm={12} className="mobile-feature-col">
                <motion.div variants={scaleIn}>
                  <Card className="h-100 text-white border-secondary feature-card mobile-feature-card">
                    <Card.Body>
                      <div className="text-success mb-3 feature-icon">
                        <i className="bi bi-chat-dots-fill" style={{ fontSize: '2rem' }}></i>
                      </div>
                      <Card.Title>Personal Financial Assistant</Card.Title>
                      <Card.Text>
                        Users get a personal assistant who understands their finances, income, and
                        expenses, answering questions with personalized insights.
                      </Card.Text>
                    </Card.Body>
                  </Card>
                </motion.div>
              </Col>

              <Col md={4} sm={12} className="mobile-feature-col">
                <motion.div variants={scaleIn}>
                  <Card className="h-100 text-white border-secondary feature-card mobile-feature-card">
                    <Card.Body>
                      <div className="text-success mb-3 feature-icon">
                        <i className="bi bi-lightning-charge" style={{ fontSize: '2rem' }}></i>
                      </div>
                      <Card.Title>Instant Integration</Card.Title>
                      <Card.Text>
                        Easy API integration with comprehensive documentation. Get up and running
                        in under 2 weeks with our simple REST endpoints.
                      </Card.Text>
                    </Card.Body>
                  </Card>
                </motion.div>
              </Col>
            </Row>
          </motion.div>
        </motion.div>
      </Container>

      {/* Banking Intelligence Command Section */}
      <Container className="py-5">
        <motion.div
          ref={commandSectionRef}
          initial="hidden"
          animate={commandSectionInView && animationsActive ? "visible" : "hidden"}
          variants={staggerContainer}
          className="banking-command-section"
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(15,26,15,0.9) 100%)',
            borderRadius: '8px',
            padding: '50px 0',
            marginTop: '20px',
            marginBottom: '40px'
          }}
        >
          {/* Background animated circuit pattern */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 0,
              opacity: 0.15
            }}
          >
            <div className="circuit-pattern">
              {[...Array(15)].map((_, i) => (
                <motion.div
                  key={i}
                  className="circuit-node"
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{
                    duration: 3 + Math.random() * 3,
                    repeat: Infinity,
                    delay: Math.random() * 2
                  }}
                  style={{
                    position: 'absolute',
                    width: 3 + Math.random() * 4,
                    height: 3 + Math.random() * 4,
                    backgroundColor: '#28a745',
                    borderRadius: '50%',
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`
                  }}
                />
              ))}

              {[...Array(10)].map((_, i) => (
                <motion.div
                  key={`line-${i}`}
                  className="circuit-line"
                  initial={{ opacity: 0.1 }}
                  animate={{ opacity: [0.1, 0.3, 0.1] }}
                  transition={{
                    duration: 4 + Math.random() * 3,
                    repeat: Infinity,
                    delay: Math.random() * 2
                  }}
                  style={{
                    position: 'absolute',
                    width: 150 + Math.random() * 200,
                    height: 1,
                    backgroundColor: '#28a745',
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    transform: `rotate(${Math.random() * 180}deg)`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Header Section */}
          <motion.div
            className="text-center mb-5"
            variants={fadeIn}
            style={{ position: 'relative', zIndex: 1 }}
          >
            <motion.h2
              className="text-success mb-3"
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
              Banking Intelligence Command
            </motion.h2>
            <motion.p
              className="text-white mx-auto"
              style={{ maxWidth: '800px' }}
              variants={fadeIn}
            >
              Banking Intelligence Command provides your institution with a holistic picture
              of your financial operations. This data service captures, processes, and interprets
              analytics from each user into personalized reporting for everything from customer
              profiling to advanced risk management.
            </motion.p>
          </motion.div>

          {/* Command Cards Section */}
          <Row className="mb-5 mobile-command-row">
            {[
              {
                icon: "bi-database-fill",
                title: "Capture",
                description: "Capture every single transaction with all relevant data points and metadata for comprehensive analysis."
              },
              {
                icon: "bi-cpu-fill",
                title: "Process",
                description: "Run collected data through advanced logic, mathematical models, and AI algorithms for deep insights."
              },
              {
                icon: "bi-bar-chart-fill",
                title: "Analyze",
                description: "Generate spending patterns, income elasticities, category preferences, and behavioral insights."
              },
              {
                icon: "bi-gear-fill",
                title: "Action",
                description: "Design risk protocols, targeted campaigns, marketing timing, product introductions, and much more."
              }
            ].map((card, index) => (
              <Col md={3} sm={6} xs={12} key={index} className="mb-4 mobile-command-col">
                <motion.div
                  variants={{
                    hidden: { y: 20, opacity: 0 },
                    visible: {
                      y: 0,
                      opacity: 1,
                      transition: { duration: 0.5, ease: "easeOut", delay: index * 0.1 }
                    }
                  }}
                  whileHover={{
                    scale: 1.05,
                    boxShadow: "0 10px 25px rgba(40, 167, 69, 0.3)"
                  }}
                  transition={{ duration: 0.3 }}
                  style={{ height: '100%' }}
                  className="command-card-container"
                >
                  <Card className="h-100 text-white border-success command-card">
                    <Card.Body className="d-flex flex-column align-items-center text-center" style={{ zIndex: 1, position: 'relative' }}>
                      <motion.div
                        className="command-icon text-success mb-3"
                        whileHover={{
                          scale: 1.1,
                          backgroundColor: "rgba(40, 167, 69, 0.2)"
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '70px',
                          height: '70px',
                          borderRadius: '50%',
                          background: 'rgba(40, 167, 69, 0.1)',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <i className={`bi ${card.icon}`} style={{ fontSize: '2rem' }}></i>
                      </motion.div>

                      <Card.Title>{card.title}</Card.Title>
                      <Card.Text>
                        {card.description}
                      </Card.Text>
                    </Card.Body>
                  </Card>
                </motion.div>
              </Col>
            ))}
          </Row>

          {/* Analytics Visualization */}
          <motion.div
            variants={{
              hidden: { y: 20, opacity: 0 },
              visible: {
                y: 0,
                opacity: 1,
                transition: { duration: 0.5, ease: "easeOut" }
              }
            }}
            className="analytics-dashboard p-4 mb-4 mx-auto"
            style={{
              background: 'rgba(15,26,15,0.8)',
              borderRadius: '8px',
              border: '1px solid rgba(40, 167, 69, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              maxWidth: '90%'
            }}
          >
            <Row className="align-items-center">
              <Col md={4} sm={12} className="mb-3 mb-md-0">
                <h3 className="text-success">Real-time Analytics</h3>
                <p className="text-white mb-md-0">Our AI continuously analyzes transaction patterns to identify opportunities and risks in real-time.</p>
              </Col>
              <Col md={8} sm={12}>
                <div
                  style={{
                    position: 'relative',
                    height: '120px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '4px',
                    padding: '10px',
                    overflow: 'hidden'
                  }}
                >
                  {/* Graph visualization */}
                  <svg width="100%" height="100" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: '10px', left: '10px', right: '10px' }}>
                    {/* Create a smooth line that animates in */}
                    <motion.path
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 2, ease: "easeInOut" }}
                      d="M0,80 C10,70 20,85 30,60 C40,40 50,60 60,50 C70,40 80,30 90,35 C95,38 100,30 100,30"
                      fill="none"
                      stroke="#28a745"
                      strokeWidth="2"
                      strokeDasharray="0"
                    />

                    {/* Area fill under the line */}
                    <motion.path
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.3 }}
                      transition={{ duration: 2 }}
                      d="M0,80 C10,70 20,85 30,60 C40,40 50,60 60,50 C70,40 80,30 90,35 C95,38 100,30 100,30 V100 H0 Z"
                      fill="url(#graphGradient)"
                    />

                    <defs>
                      <linearGradient id="graphGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#28a745" stopOpacity="0.7" />
                        <stop offset="100%" stopColor="#28a745" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>

                  {/* Animated data points */}
                  {[30, 60, 50, 35].map((point, index) => {
                    const xPos = 30 + (index * 20);
                    return (
                      <motion.div
                        key={index}
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1], boxShadow: ["0 0 0px rgba(40, 167, 69, 0.8)", "0 0 10px rgba(40, 167, 69, 0.8)", "0 0 5px rgba(40, 167, 69, 0.8)"] }}
                        transition={{ duration: 0.8, delay: 1 + (index * 0.2) }}
                        style={{
                          position: 'absolute',
                          left: `${xPos}%`,
                          top: `${point}%`,
                          width: '6px',
                          height: '6px',
                          backgroundColor: '#28a745',
                          borderRadius: '50%',
                          transform: 'translate(-50%, -50%)'
                        }}
                      />
                    );
                  })}

                  {/* Stats indicators */}
                  <div className="d-flex justify-content-between mt-4 pt-5" style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px' }}>
                    {['Spending', 'Savings', 'Income'].map((label, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.5 + (i * 0.2) }}
                        style={{
                          padding: '4px 8px',
                          background: 'rgba(40, 167, 69, 0.2)',
                          borderRadius: '4px',
                          color: '#fff',
                          fontSize: '0.8rem'
                        }}
                      >
                        <span className="me-1">
                          <i className={`bi bi-${i === 0 ? 'cart' : i === 1 ? 'piggy-bank' : 'cash'}`}></i>
                        </span>
                        {label}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Col>
            </Row>

          </motion.div>
        </motion.div>
      </Container>

      {/* Target Audience Section */}
      <Container className="py-5">
        <motion.div
          ref={targetAudienceRef}
          initial="hidden"
          animate={targetAudienceInView && animationsActive ? "visible" : "hidden"}
          variants={staggerContainer}
          className="target-audience-section"
        >
          <motion.div
            className="text-center mb-5"
            variants={fadeIn}
          >
            <h2 className="text-success mb-4">You Need Banking Intelligence If You Are...</h2>
            <p className="text-white mx-auto" style={{ maxWidth: '800px' }}>
              Banking Intelligence is designed for any organization that manages money and wants to
              provide better financial experiences to their customers.
            </p>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Row className="g-4 mobile-features-row">
              {[
                {
                  icon: "bi-bank",
                  title: "Traditional Banks",
                  description: "Modernize your banking services with AI-powered insights and personalized customer experiences."
                },
                {
                  icon: "bi-phone",
                  title: "Neobanks & Fintechs",
                  description: "Differentiate your digital banking platform with advanced AI capabilities and smart financial guidance."
                },
                {
                  icon: "bi-shield-check",
                  title: "Insurance Companies",
                  description: "Leverage financial data insights for better risk assessment and personalized insurance products."
                },
                {
                  icon: "bi-building",
                  title: "Credit Unions",
                  description: "Enhance member services with personalized financial advice and improved engagement tools."
                },
                {
                  icon: "bi-graph-up",
                  title: "Investment Platforms",
                  description: "Provide smarter investment recommendations based on comprehensive financial analysis."
                },
                {
                  icon: "bi-wallet2",
                  title: "Financial Service Providers",
                  description: "Any business handling money transactions can benefit from our intelligent financial insights."
                }
              ].map((item, index) => (
                <Col md={4} sm={12} key={index} className="mobile-feature-col">
                  <motion.div variants={scaleIn}>
                    <Card className="h-100 text-white border-secondary feature-card mobile-feature-card">
                      <Card.Body>
                        <div className="text-success mb-3 feature-icon">
                          <i className={`bi ${item.icon}`} style={{ fontSize: '2rem' }}></i>
                        </div>
                        <Card.Title>{item.title}</Card.Title>
                        <Card.Text>
                          {item.description}
                        </Card.Text>
                      </Card.Body>
                    </Card>
                  </motion.div>
                </Col>
              ))}
            </Row>
          </motion.div>
        </motion.div>
      </Container>

      {/* Expected Results Section */}
      <Container className="py-5">
        <motion.div
          ref={resultsRef}
          initial="hidden"
          animate={resultsInView && animationsActive ? "visible" : "hidden"}
          variants={staggerContainer}
          className="results-section"
        >
          <motion.div
            className="text-center mb-5"
            variants={fadeIn}
          >
            <h2 className="text-success mb-4">Your Expected Results</h2>
            <p className="text-white mx-auto" style={{ maxWidth: '800px' }}>
              Based on our testing and implementation with financial institutions,
              here's what you can expect from Banking Intelligence:
            </p>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Row className="g-4 mobile-stats-row mb-5">
              <Col md={3} sm={6} className="mobile-stat-col">
                <div className="stat-card">
                  <div className="stat-icon text-success">
                    <i className="bi bi-clock-history"></i>
                  </div>
                  <h2 className="text-white mobile-stat-number">
                    {animationsActive && <CountUp end={300} suffix="%" duration={2.5} delay={0.2} />}
                  </h2>
                  <p className="text-light mobile-stat-label">Increase in Interaction Time</p>
                </div>
              </Col>
              <Col md={3} sm={6} className="mobile-stat-col">
                <div className="stat-card">
                  <div className="stat-icon text-success">
                    <i className="bi bi-piggy-bank"></i>
                  </div>
                  <h2 className="text-white mobile-stat-number">
                    {animationsActive && <CountUp end={78} suffix="%" duration={2.5} delay={0.3} />}
                  </h2>
                  <p className="text-light mobile-stat-label">Users Show Savings Effect</p>
                </div>
              </Col>
              <Col md={3} sm={6} className="mobile-stat-col">
                <div className="stat-card">
                  <div className="stat-icon text-success">
                    <i className="bi bi-graph-up"></i>
                  </div>
                  <h2 className="text-white mobile-stat-number">
                    {animationsActive && <CountUp end={5} suffix="%" duration={2.5} delay={0.4} />}
                  </h2>
                  <p className="text-light mobile-stat-label">Est. Savings for Institution</p>
                </div>
              </Col>
              <Col md={3} sm={6} className="mobile-stat-col">
                <div className="stat-card">
                  <div className="stat-icon text-success">
                    <i className="bi bi-calendar-week"></i>
                  </div>
                  <h2 className="text-white mobile-stat-number">
                    {animationsActive && <CountUp end={2} duration={2.5} delay={0.5} />}
                  </h2>
                  <p className="text-light mobile-stat-label">Weeks to Integration</p>
                </div>
              </Col>
            </Row>

            {/* Additional metrics from PDF */}
            <Row className="g-4 mobile-stats-row">
              <Col md={4} sm={6} className="mobile-stat-col">
                <div className="stat-card">
                  <div className="stat-icon text-success">
                    <i className="bi bi-translate"></i>
                  </div>
                  <h2 className="text-white mobile-stat-number">
                    {animationsActive && <CountUp end={24} duration={2.5} delay={0.6} />}
                  </h2>
                  <p className="text-light mobile-stat-label">Languages Supported</p>
                </div>
              </Col>
              <Col md={4} sm={6} className="mobile-stat-col">
                <div className="stat-card">
                  <div className="stat-icon text-success">
                    <i className="bi bi-shield-check"></i>
                  </div>
                  <h2 className="text-white mobile-stat-number">
                    {animationsActive && <CountUp end={100} suffix="%" duration={2.5} delay={0.7} />}
                  </h2>
                  <p className="text-light mobile-stat-label">Security Attack Defense</p>
                </div>
              </Col>
              <Col md={4} sm={12} className="mobile-stat-col">
                <div className="stat-card">
                  <div className="stat-icon text-success">
                    <i className="bi bi-currency-dollar"></i>
                  </div>
                  <h2 className="text-white mobile-stat-number">
                    $0.25
                  </h2>
                  <p className="text-light mobile-stat-label">Per Customer Per Month</p>
                </div>
              </Col>
            </Row>
          </motion.div>
        </motion.div>
      </Container>

      {/* How it works section */}
      <motion.div
        ref={howItWorksRef}
        initial="hidden"
        animate={howItWorksInView && animationsActive && contentVisible ? "visible" : "hidden"}
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
            <Row className="align-items-center mb-5 mobile-step-row">
              <Col md={6} sm={12} className="mobile-step-text">
                <motion.div
                  className="bg-success p-4 rounded mb-3 mb-md-0 w-100 mobile-step-content"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-white">1. Register for an API Key</h4>
                  <p className="text-black">Create an account and get your API key to integrate our services.</p>
                </motion.div>
              </Col>
              <Col md={6} sm={12} className="mobile-step-code">
                <motion.pre
                  className="bg-black p-4 rounded text-white code-block w-100 mobile-code-block"
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
            <Row className="align-items-center mb-5 mobile-step-row">
              <Col md={{ span: 6, order: 'last' }} sm={12} className="mobile-step-text">
                <motion.div
                  className="bg-success p-4 rounded mb-3 mb-md-0 w-100 mobile-step-content"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-white">2. Connect User Data</h4>
                  <p className="text-black">Send financial data to our API via secure endpoints.</p>
                </motion.div>
              </Col>
              <Col md={6} sm={12} className="mobile-step-code">
                <motion.pre
                  className="bg-black p-3 rounded text-white code-block w-100 mobile-code-block"
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
            <Row className="align-items-center mobile-step-row">
              <Col md={6} sm={12} className="mobile-step-text">
                <motion.div
                  className="bg-success p-4 rounded mb-3 mb-md-0 w-100 mobile-step-content"
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-white">3. Get Personalized Insights</h4>
                  <p className="text-black">Receive AI-powered financial insights to display in your app.</p>
                </motion.div>
              </Col>
              <Col md={6} sm={12} className="mobile-step-code">
                <motion.pre
                  className="bg-black p-3 rounded text-white code-block w-100 mobile-code-block"
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

      {/* Contact and Next Steps Section */}
      {/* Contact and Next Steps Section */}
      <motion.div
        ref={ctaRef}
        initial={{ opacity: 0, y: 50 }}
        animate={ctaInView && animationsActive && contentVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.8 }}
        className="py-5 cta-section mobile-cta-section"
        style={{
          background: 'linear-gradient(180deg, #000000 0%, #0f1a0f 100%)',
          borderRadius: '8px',
          margin: '2rem 0'
        }}
      >
        <Container>
          <Row className="justify-content-center">
            <Col md={8}>
              <div className="text-center mb-5">
                <motion.h2
                  className="text-success mb-4 mobile-cta-title"
                  animate={ctaInView && animationsActive ?
                    { scale: [1, 1.05, 1], textShadow: "0 0 8px rgba(40, 167, 69, 0.5)" } : {}
                  }
                  transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
                >
                  Ready to Move Forward?
                </motion.h2>
                <motion.p
                  className="text-light mb-4 mobile-cta-text"
                  animate={ctaInView && animationsActive ? { opacity: [0.7, 1, 0.7] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Contact us directly or fill out the form below. A member of our team will be with you shortly!
                  Alternatively, you can schedule a beta test by registering (all members need approval and
                  prior communication).
                </motion.p>
              </div>

              {/* Contact Options */}
              <Row className="mb-5">
                <Col md={6} className="mb-3">
                  <motion.div
                    className="text-center p-4 border border-success rounded"
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(40, 167, 69, 0.1)" }}
                    transition={{ duration: 0.3 }}
                  >
                    <i className="bi bi-envelope-fill text-success mb-3" style={{ fontSize: '2rem' }}></i>
                    <h5 className="text-white">Direct Contact</h5>
                    <a href="mailto:business@vivytech.com" className="text-success">
                      business@vivytech.com
                    </a>
                    <p className="text-light mt-2 small">
                      For immediate business inquiries
                    </p>
                  </motion.div>
                </Col>
                <Col md={6} className="mb-3">
                  <motion.div
                    className="text-center p-4 border border-success rounded"
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(40, 167, 69, 0.1)" }}
                    transition={{ duration: 0.3 }}
                  >
                    <i className="bi bi-calendar-check-fill text-success mb-3" style={{ fontSize: '2rem' }}></i>
                    <h5 className="text-white">Beta Testing</h5>
                    <Link to="/register" className="text-success">
                      Register for Beta Access
                    </Link>
                    <p className="text-light mt-2 small">
                      Requires approval and prior communication
                    </p>
                  </motion.div>
                </Col>
              </Row>

              {/* Contact Form */}
              <motion.div
                className="contact-form-container p-4"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '8px',
                  border: '1px solid rgba(40, 167, 69, 0.3)'
                }}
                whileHover={{ borderColor: "rgba(40, 167, 69, 0.6)" }}
                transition={{ duration: 0.3 }}
              >
                <h4 className="text-success text-center mb-4">Contact Our Team</h4>

                {submitStatus === 'success' && (
                  <motion.div
                    className="alert alert-success"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    Thank you! We'll be in touch shortly.
                  </motion.div>
                )}

                {submitStatus === 'error' && (
                  <motion.div
                    className="alert alert-danger"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {errorMessage || 'There was an error sending your message. Please try again or email us directly.'}
                  </motion.div>
                )}

                <Form onSubmit={handleContactSubmit}>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label className="text-white">Name *</Form.Label>
                        <Form.Control
                          type="text"
                          required
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          className="bg-black text-white border-secondary"
                          style={{ borderColor: '#6c757d' }}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label className="text-white">Email *</Form.Label>
                        <Form.Control
                          type="email"
                          required
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          className="bg-black text-white border-secondary"
                          style={{ borderColor: '#6c757d' }}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-3">
                    <Form.Label className="text-white">Company</Form.Label>
                    <Form.Control
                      type="text"
                      value={contactForm.company}
                      onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                      className="bg-black text-white border-secondary"
                      style={{ borderColor: '#6c757d' }}
                    />
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label className="text-white">Message *</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      required
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      className="bg-black text-white border-secondary"
                      style={{ borderColor: '#6c757d' }}
                      placeholder="Tell us about your institution and how you'd like to use Banking Intelligence..."
                    />
                  </Form.Group>

                  <div className="text-center">
                    <motion.button
                      type="submit"
                      className="btn btn-success btn-lg px-5"
                      disabled={isSubmitting}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Sending...
                        </>
                      ) : (
                        'Send Message'
                      )}
                    </motion.button>
                  </div>
                </Form>
              </motion.div>
            </Col>
          </Row>
        </Container>
      </motion.div>
    </div >
  );
};

export default HomePage;