import './style.css'
import { initCherryBlossoms } from './cherryBlossom'
import { initNodesBackground } from './nodesBackground'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, MotionPathPlugin)

// Initialize wind control object globally to prevent any undefined target errors in GSAP
window.sakuraWind = {
  speedX: 0.8,
  speedY: 1.2,
  wobbleSpeed: 0.02
}

// Wrap initialization in window load event to ensure all styles, images, and DOM structures are fully resolved
window.addEventListener('load', () => {
  console.log("Aether Landing Page: Initializing GSAP and ScrollTrigger...");
  console.log("GSAP Version:", gsap.version);
  console.log("ScrollTrigger Version:", ScrollTrigger.version);

  // Start Canvas Particle Systems
  initCherryBlossoms('cherry-blossom-canvas')
  initNodesBackground('nodes-canvas')

  // Set Initial States
  gsap.set("#scene-1", { autoAlpha: 1 })
  gsap.set("#scene-2", { autoAlpha: 0 })
  gsap.set("#scene-3", { autoAlpha: 0 })
  gsap.set("#scene-4", { autoAlpha: 0 })
  gsap.set("#scene-5", { autoAlpha: 0 })

  // Global phone initial positions
  gsap.set("#phone-element", { 
    scale: 0.12, 
    y: 320, 
    opacity: 0, 
    rotationX: 0, 
    rotationY: 0, 
    rotation: 0,
    transformOrigin: "center center"
  })

  // Initialize card deck values for Scene 4 fanning
  const cards = gsap.utils.toArray('.deck-card')
  const fannedOffsets = [
    { x: -160, y: 150, rotation: -20, scale: 0.85 },
    { x: -50, y: 110, rotation: -8, scale: 0.9 },
    { x: 50, y: 110, rotation: 8, scale: 0.9 },
    { x: 160, y: 150, rotation: 20, scale: 0.85 }
  ]

  // Statically position cards in fanned state relative to their layout spots
  cards.forEach((card, idx) => {
    gsap.set(card, {
      x: fannedOffsets[idx].x,
      y: fannedOffsets[idx].y,
      rotation: fannedOffsets[idx].rotation,
      scale: fannedOffsets[idx].scale,
      transformOrigin: "bottom center"
    })
  })

  // Statically position collage elements in Scene 5
  gsap.set("#layer-tower", { opacity: 0, y: 100, x: -80 })
  gsap.set("#layer-waves", { opacity: 0, scale: 0.4 })
  gsap.set(".cta-box", { opacity: 0, scale: 0.88 })

  // Master Cinematic Scroll Timeline
  const masterTL = gsap.timeline({
    scrollTrigger: {
      trigger: "#scroll-container",
      start: "top top",
      end: "bottom bottom",
      scrub: 1.5, // smooth scrubbing duration
      pin: ".viewport",
      anticipatePin: 1
    }
  })

  // Build Timeline Choreography

  // --- SCENE 1: OPENING ATMOSPHERE -> CAMERA PUSH (0.0 to 0.20) ---
  masterTL
    .to(".title-overlay", { 
      y: -80, 
      opacity: 0, 
      duration: 1.2, 
      ease: "power2.inOut" 
    })
    .to(".classroom-bg", { 
      filter: "brightness(0.65) blur(0px)", 
      duration: 1.2 
    }, "<")
    .to(window.sakuraWind, { 
      speedX: 4.8, 
      speedY: 4.2, 
      wobbleSpeed: 0.04, 
      duration: 1.2 
    }, "<")
    .to("#scene-1", { 
      autoAlpha: 0, 
      duration: 1 
    })

  // --- SCENE 2: CAMERA PUSH TO PHONE (0.20 to 0.42) ---
  masterTL
    .to("#scene-2", { 
      autoAlpha: 1, 
      duration: 0.1 
    }, "-=0.8")
    .to(".classroom-container", { 
      scale: 3.2, 
      x: -360, 
      y: -140, 
      opacity: 0.15,
      duration: 2, 
      ease: "power2.inOut" 
    }, "-=0.8")
    .to("#phone-element", { 
      opacity: 1, 
      scale: 1, 
      y: 0, 
      duration: 2, 
      ease: "power2.out" 
    }, "-=2")
    // Staggered reveal of chat messages
    .to("#msg-1", { 
      opacity: 1, 
      y: 0, 
      duration: 0.8, 
      ease: "power1.out" 
    }, "-=0.4")
    .to("#msg-2", { 
      opacity: 1, 
      y: 0, 
      duration: 0.8, 
      ease: "power1.out" 
    }, "+=0.3")
    .to("#msg-3", { 
      opacity: 1, 
      y: 0, 
      duration: 1, 
      ease: "power1.out" 
    }, "+=0.3")
    // Signal error bezel indicator
    .to(".phone-bezel", { 
      borderColor: "rgba(255, 0, 127, 0.5)", 
      boxShadow: "0 0 15px rgba(255, 0, 127, 0.45)", 
      duration: 0.6 
    }, "-=0.4")

  // --- SCENE 3: SHOCK AND FALL (0.42 to 0.65) ---
  masterTL
    // Glitch flash
    .to("#phone-glitch", { 
      opacity: 1, 
      duration: 0.4 
    })
    .to(".classroom-container", { 
      opacity: 0, 
      duration: 0.4 
    }, "<")
    .to("#scene-2", { 
      autoAlpha: 0, 
      duration: 0.4 
    }, "<")
    .to(".viewport", { 
      backgroundColor: "#000000", 
      duration: 0.6 
    }, "<")
    .to("#scene-3", { 
      autoAlpha: 1, 
      duration: 0.2 
    }, "-=0.2")
    // Staircase reveal
    .fromTo("#spiral-path", 
      { strokeDashoffset: 2000 }, 
      { strokeDashoffset: 0, duration: 2.5, ease: "power1.inOut" }
    , "-=0.2")
    // Falling phone along spiral path with 3D spin
    .to("#phone-element", {
      motionPath: {
        path: "#spiral-path",
        align: "#spiral-path",
        alignOrigin: [0.5, 0.5]
      },
      scale: 0.35,
      rotation: 720,
      rotationX: 360,
      rotationY: 180,
      duration: 2.5,
      ease: "power1.inOut"
    }, "<")
    // Crack event at bottom impact
    .to("#phone-cracks", { 
      opacity: 1, 
      duration: 0.1 
    })
    // Tiny shake effect on impact
    .to("#phone-element", { x: "+=8", y: "-=4", duration: 0.05, yoyo: true, repeat: 5 })
    .to("#phone-element", { x: 0, y: 0, duration: 0.05 }) // center alignment cleanup
    // Text reveal
    .to("#shock-text", { 
      autoAlpha: 1, 
      y: 0, 
      duration: 1, 
      ease: "back.out(1.5)" 
    }, "-=0.5")

  // --- SCENE 4: SOLUTION REVEAL (0.65 to 0.85) ---
  masterTL
    .to("#scene-3", { 
      autoAlpha: 0, 
      duration: 0.8 
    })
    .to("#phone-element", { 
      autoAlpha: 0, 
      duration: 0.8 
    }, "<")
    .to(".viewport", { 
      backgroundColor: "#f5f6f8", 
      duration: 0.8 
    }, "<")
    .to("#scene-4", { 
      autoAlpha: 1, 
      duration: 0.4 
    }, "-=0.4")
    // Header text slide up
    .from(".solution-header", { 
      y: 40, 
      opacity: 0, 
      duration: 1, 
      ease: "power2.out" 
    })
    // Cards deck snap and grid reveal
    .to(cards, {
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      stagger: 0.15,
      duration: 1.5,
      ease: "power3.out"
    }, "-=0.6")
    // Legibility fade inside cards
    .to(".card-content", { 
      opacity: 1, 
      stagger: 0.1, 
      duration: 0.8 
    }, "-=0.8")

  // --- SCENE 5: FINAL CTA FRAME (0.85 to 1.0) ---
  masterTL
    .to("#scene-4", { 
      autoAlpha: 0, 
      duration: 0.8 
    })
    .to(".viewport", { 
      backgroundColor: "#07050e", 
      duration: 0.8 
    }, "<")
    .to("#scene-5", { 
      autoAlpha: 1, 
      duration: 0.4 
    }, "-=0.4")
    // Collage elements entrance
    .to("#layer-tower", { 
      opacity: 0.85, 
      y: 0, 
      x: 0, 
      duration: 1.2, 
      ease: "back.out(1.1)" 
    }, "-=0.4")
    .to("#layer-waves", { 
      opacity: 0.6, 
      scale: 1, 
      duration: 1.2, 
      ease: "back.out(1.1)" 
    }, "-=1.0")
    // CTA Content pop
    .to(".cta-box", { 
      opacity: 1, 
      scale: 1, 
      duration: 1.2, 
      ease: "power2.out" 
    }, "-=1.0")
    // Subtle parallax effect on scroll ending
    .to("#layer-tower", { 
      y: -30, 
      duration: 0.5, 
      ease: "none" 
    }, "-=0.5")
    .to("#layer-waves", { 
      y: 20, 
      duration: 0.5, 
      ease: "none" 
    }, "<")

  // Trigger an initial refresh of ScrollTrigger configurations to compute dimensions correctly
  ScrollTrigger.refresh()

  // Scroll debugging listener
  window.addEventListener('scroll', () => {
    console.log("Aether ScrollPosition:", window.scrollY);
  });
})
