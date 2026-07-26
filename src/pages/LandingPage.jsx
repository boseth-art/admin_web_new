import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, LinearProgress } from '@mui/material';
import { motion } from 'framer-motion';

const QUOTES = [
  {
    text: "Do not save what is left after spending, but spend what is left after saving.",
    author: "Warren Buffett"
  },
  {
    text: "Wealth consists not in having great possessions, but in having few wants.",
    author: "Epictetus"
  },
  {
    text: "An investment in knowledge pays the best interest.",
    author: "Benjamin Franklin"
  }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const DURATION_MS = 10000;
  const UPDATE_INTERVAL_MS = 50;
  
  // Select a random quote on mount
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  useEffect(() => {
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / DURATION_MS) * 100, 100);
      setProgress(newProgress);
      
      if (elapsed >= DURATION_MS) {
        clearInterval(interval);
        navigate('/about');
      }
    }, UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        background: '#070D18',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background Image with Overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'url("https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=2000&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.15,
          zIndex: 0,
        }}
      />
      
      {/* Gradient Overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(circle at center, transparent 0%, #070D18 80%)',
          zIndex: 1,
        }}
      />

      <Box sx={{ zIndex: 10, textAlign: 'center', px: 4, maxWidth: 800 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          <Typography 
            variant="h3" 
            sx={{ 
              color: '#F0F6FF', 
              fontStyle: 'italic', 
              fontWeight: 300, 
              mb: 3,
              lineHeight: 1.4,
              fontFamily: 'serif'
            }}
          >
            "{quote.text}"
          </Typography>
          
          <Typography 
            variant="h6" 
            sx={{ 
              color: '#2DD4BF', 
              fontWeight: 600, 
              letterSpacing: 2, 
              textTransform: 'uppercase' 
            }}
          >
            — {quote.author}
          </Typography>
        </motion.div>
      </Box>

      {/* Progress & Skip Section */}
      <Box 
        sx={{ 
          position: 'absolute', 
          bottom: 40, 
          left: 0, 
          right: 0, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 2,
          zIndex: 10 
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
        >
          <Button 
            onClick={() => navigate('/about')}
            sx={{ 
              color: '#94A3B8', 
              textTransform: 'none', 
              fontSize: '1rem',
              '&:hover': { color: '#F0F6FF', background: 'transparent' }
            }}
          >
            Skip to site &rarr;
          </Button>
        </motion.div>

        <Box sx={{ width: '100%', maxWidth: 300 }}>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ 
              height: 2, 
              background: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(90deg, #2DD4BF, #6366F1)'
              }
            }} 
          />
        </Box>
      </Box>
    </Box>
  );
}
