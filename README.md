# Wireless & Mobile Communication Virtual Lab

<p align="center">
  <img src="frontend/public/logo.png" width="180" alt="WMC Virtual Lab Logo"/>

<h2 align="center">
Wireless & Mobile Communication Virtual Laboratory
</h2>

<p align="center">
An interactive cross-platform virtual laboratory for Wireless & Mobile Communication that combines a modern web application, FastAPI backend, and native Android integration to deliver real-time networking experiments using actual device hardware.
</p>

<p align="center">

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi)

![Android](https://img.shields.io/badge/Android-Kotlin-3DDC84?style=for-the-badge&logo=android)

![Python](https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python)

![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite)

![License](https://img.shields.io/badge/License-Educational-green?style=for-the-badge)

</p>

---

# Overview

Wireless & Mobile Communication Virtual Lab is a modern educational platform developed to digitize practical laboratory experiments in Wireless & Mobile Communication.

Unlike traditional virtual labs that only simulate networking concepts, this platform combines **real hardware interaction**, **native Android capabilities**, **browser-based visualizations**, and **backend analysis services** to provide students with an immersive practical learning experience.

The project enables students to perform networking experiments directly from their computers or Android devices without requiring expensive laboratory hardware.

The platform integrates:

- Modern React Web Application
- FastAPI Backend
- Native Android Application
- Bluetooth Communication
- Wi-Fi Signal Analysis
- Network Performance Testing
- Wireless Propagation Simulation
- Interactive Visualizations

into one unified educational ecosystem.

---

# Vision

Traditional networking laboratories often suffer from several challenges:

- Limited laboratory access
- Expensive networking hardware
- Limited experiment availability
- Manual observation recording
- Difficulty performing experiments remotely

The Wireless & Mobile Communication Virtual Lab aims to eliminate these limitations by creating a cross-platform digital laboratory where students can perform experiments anytime using software and available hardware resources.

---

# Objectives

The project has been designed to:

- Improve practical learning
- Reduce dependence on physical laboratory infrastructure
- Support hybrid learning environments
- Visualize complex networking concepts
- Enable real-time wireless experimentation
- Bridge theoretical concepts with practical implementation

---

# Core Features

## Cross Platform Support

The platform consists of three independent yet connected systems.

### Web Application

Provides:

- Experiment Interface
- Interactive Visualizations
- Reports
- Graphical Analysis
- Experiment Instructions

---

### FastAPI Backend

Responsible for:

- Wi-Fi Analysis
- Bluetooth Communication
- Signal Processing
- Network Testing
- REST APIs
- Experiment Logic

---

### Native Android Application

Provides direct access to device hardware including:

- Bluetooth
- Wi-Fi
- Native Permissions
- WebView Bridge
- Hardware APIs

The Android application enables experiments that are impossible to perform using standard web browsers.

---

# Experiments Included

The platform currently supports the following Wireless & Mobile Communication practicals.

## Practical 4

### Wi-Fi Signal Strength Analysis

Students can:

- Scan nearby Wi-Fi networks
- Measure RSSI
- Compare signal strength
- Analyze signal degradation
- Observe wireless coverage

---

## Practical 5

### Network Throughput & Latency

Measure:

- Download Speed
- Upload Speed
- Ping
- Latency
- Response Time

using real networking APIs.

---

## Practical 6

### Bluetooth Communication

Explore Bluetooth networking by:

- Discovering nearby devices
- Viewing device information
- Simulating pairing
- Studying Bluetooth communication

---

## Practical 7

### Path Loss Analysis

Study how wireless signals are affected by:

- Distance
- Walls
- Buildings
- Obstacles
- Environmental attenuation

---

## Practical 8

### Multipath Propagation

Visualize:

- Direct Signal
- Reflected Signal
- Signal Delay
- Fading
- Multipath Effects

through interactive demonstrations.

---

## Practical 9

### Noise & Interference

Analyze wireless communication quality using:

- Signal-to-Noise Ratio
- Environmental Noise
- Channel Congestion
- Interference Sources

---

# Complete Workflow

```

Student

↓

Choose Experiment

↓

Web Interface

↓

REST API

↓

Backend Processing

↓

Hardware Access

↓

Result Analysis

↓

Visualization

↓

Observation

```

---

# System Architecture

```

                   Wireless & Mobile Communication Lab

                         Student

                            │

            ┌───────────────┼────────────────┐

            ▼               ▼                ▼

     React Web App     Android App     FastAPI Backend

            │               │                │

            └───────────────┼────────────────┘

                            ▼

                   Experiment Services

      ┌────────────┬────────────┬─────────────┐

      ▼            ▼            ▼

 Wi-Fi Service Bluetooth Service Network Service

      ▼            ▼            ▼

 Native Hardware    Analysis Engine

            │

            ▼

 Interactive Results

```

---

# Why This Project?

Unlike conventional networking simulations, this platform combines **real hardware interaction** with **interactive software visualization**.

The result is a learning experience that is closer to working with actual networking equipment while remaining accessible through web and mobile devices.

Students gain practical understanding of wireless communication concepts rather than simply observing pre-recorded simulations.

---

# Highlights

- React + Vite Frontend
- FastAPI Backend
- Native Android Application
- Hardware Bridge
- Bluetooth Integration
- Wi-Fi Analysis
- REST APIs
- Interactive Visualizations
- Modular Architecture
- Cross Platform Design
- Educational Simulations
- Real Hardware Access

---

# Frontend Architecture

The frontend is built using **React 18** and **Vite**, providing a fast, responsive, and modular user experience.

The application follows a page-based architecture where each practical experiment is implemented as an independent module, allowing future experiments to be added without affecting the existing system.

### Frontend Responsibilities

- Interactive Experiment Interface
- Data Visualization
- User Instructions
- Experiment Navigation
- Result Presentation
- API Communication
- Android Hardware Integration
- Responsive User Interface

---

## Frontend Structure

```text
frontend/

├── src/
│
├── assets/
│
├── components/
│   ├── Navbar
│   ├── Footer
│   ├── Cards
│   ├── Charts
│   └── Shared Components
│
├── pages/
│   ├── Home
│   ├── Practical4
│   ├── Practical5
│   ├── Practical6
│   ├── Practical7
│   ├── Practical8
│   └── Practical9
│
├── services/
│
├── utils/
│
└── App.jsx
```

Each experiment is isolated into its own page, making the application highly maintainable.

---

# Backend Architecture

The backend is developed using **FastAPI**, providing lightweight and high-performance REST APIs for all networking experiments.

Instead of placing all experiment logic inside one application, each practical has its own dedicated service.

This modular approach improves readability, scalability, and future maintenance.

---

## Backend Responsibilities

The backend manages:

- Wi-Fi Scanning
- Bluetooth Communication
- Network Testing
- Signal Processing
- Path Loss Calculations
- Multipath Analysis
- Interference Analysis
- Hardware Communication
- Experiment APIs

---

## Backend Structure

```text
backend/

├── main.py
│
├── routers/
│
├── services/
│
├── wifi/
│
├── bluetooth/
│
├── network/
│
├── utils/
│
└── requirements.txt
```

Each experiment exposes its own REST API, allowing the frontend to communicate independently with every service.

---

# Android Application

One of the most significant components of the project is the native Android application.

Unlike a standard WebView wrapper, the Android application serves as a hardware access layer that bridges web technologies with native Android APIs.

The application provides access to device capabilities that are unavailable inside modern browsers.

---

## Android Responsibilities

The Android application handles:

- Bluetooth Access
- Wi-Fi Access
- Permission Management
- Native API Integration
- Hardware Communication
- WebView Bridge
- Device Discovery

---

# Android Architecture

```text
Android Application

        │

        ▼

MainActivity

        │

        ▼

WebView

        │

        ▼

Javascript Bridge

        │

        ▼

Native Android APIs

        │

        ▼

Bluetooth / Wi-Fi Hardware
```

The WebView Bridge enables the web application to communicate directly with native Android services while maintaining a clean separation between frontend logic and hardware interaction.

---

# Repository Pattern

The Android application follows the Repository Pattern to separate business logic from hardware implementation.

Instead of allowing UI components to communicate directly with Android system services, repositories encapsulate hardware operations.

Example repositories include:

- Bluetooth Repository
- Wi-Fi Repository
- Network Repository

Benefits include:

- Better maintainability
- Easier testing
- Separation of concerns
- Improved scalability

---

# Dependency Injection

The Android application adopts Dependency Injection principles to reduce coupling between components.

Advantages include:

- Modular architecture
- Easier maintenance
- Improved code reuse
- Better testing support

This architecture enables hardware services to be replaced or extended with minimal impact on the rest of the application.

---

# Hardware Bridge

The Hardware Bridge is one of the defining features of the project.

Browsers cannot directly access many device capabilities due to security restrictions.

The Android application overcomes these limitations by exposing controlled native APIs to the web application.

```text
React Application

        │

        ▼

JavaScript Interface

        │

        ▼

Android Bridge

        │

        ▼

Native Kotlin Code

        │

        ▼

Bluetooth

Wi-Fi

Network APIs
```

This architecture allows students to perform experiments using real device hardware through a familiar web interface.

---

# Bluetooth Module

The Bluetooth subsystem enables practical experiments involving nearby device discovery and communication.

Capabilities include:

- Device Discovery
- Signal Detection
- Device Information
- Pairing Demonstration
- Connection Simulation
- Hardware Communication

The module abstracts Android Bluetooth APIs behind repository classes, simplifying frontend integration.

---

# Wi-Fi Module

The Wi-Fi subsystem provides access to wireless network information.

Students can analyze:

- Available Networks
- RSSI Values
- Signal Strength
- Frequency Bands
- Access Point Information

Real-time Wi-Fi measurements allow experiments to reflect actual environmental conditions.

---

# Network Analysis Module

This module evaluates network performance through practical measurements.

Supported analyses include:

- Download Speed
- Upload Speed
- Latency
- Ping
- Network Quality

Results are visualized within the frontend to help students interpret networking concepts.

---

# REST API Design

The backend follows a feature-based REST architecture.

```text
/api/

├── wifi
│
├── bluetooth
│
├── bluetooth/connection
│
├── bluetooth/analysis
│
├── network
│
├── pathloss
│
├── multipath
│
└── interference
```

Each endpoint is dedicated to a single experiment, reducing coupling between modules and making future extensions straightforward.

---

# Experiment Processing Pipeline

Every experiment follows a consistent processing workflow.

```text
User Action

      │

      ▼

Frontend

      │

      ▼

REST API

      │

      ▼

Experiment Service

      │

      ▼

Hardware / Simulation Engine

      │

      ▼

Data Processing

      │

      ▼

Visualization

      │

      ▼

Student Observation
```

This separation ensures that experiment logic, hardware access, and visualization remain independent.

---

# Offline Support

The Android application bundles experiment assets locally, allowing students to continue using the laboratory even with limited internet connectivity.

Offline resources include:

- Experiment Instructions
- Static Assets
- Documentation
- HTML Resources
- Local Web Content

This improves accessibility in educational environments with unreliable network access.

---

# Engineering Highlights

The project demonstrates several production-quality engineering practices.

- Modular React Architecture
- FastAPI REST Services
- Native Android Integration
- Repository Pattern
- Dependency Injection
- Hardware Abstraction Layer
- WebView Bridge
- Feature-Based API Design
- Experiment Isolation
- Cross-Platform Development
- Reusable Components
- Scalable Project Organization

---

# Project Structure

The repository is organized into multiple independent projects, each serving a specific purpose within the Virtual Lab ecosystem.

```text
wmc-virtual-lab/

├── frontend/                  # React Web Application
│
├── backend/                   # FastAPI Backend
│
├── android/                   # Native Android Application
│
├── docs/                      # Experiment Documentation
│
├── assets/                    # Images & Static Resources
│
├── experiment_templates/      # Practical Files
│
├── desktop_build/             # PyInstaller Desktop Build
│
└── README.md
```

This separation allows each platform to evolve independently while sharing a common educational objective.

---

# Software Architecture

The project follows a layered architecture that separates presentation, business logic, and hardware interaction.

```text
                    Presentation Layer

        React Web App      Android UI

                    │

────────────────────────────────────────────

                    Application Layer

          REST APIs   Experiment Logic

────────────────────────────────────────────

                    Service Layer

 Wi-Fi Service Bluetooth Service Network Service

────────────────────────────────────────────

                 Hardware Layer

 Bluetooth Adapter

 Wi-Fi Adapter

 Android Hardware APIs
```

This architecture minimizes coupling between components while improving maintainability.

---

# Technology Stack

## Frontend

The user interface is developed using modern frontend technologies.

- React 18
- Vite
- JavaScript (ES6+)
- React Router
- HTML5
- CSS3

---

## Backend

The backend is powered by Python and FastAPI.

- FastAPI
- Python
- Uvicorn
- REST APIs
- Pydantic

---

## Android

The native Android application is developed using:

- Kotlin
- Android SDK
- AndroidX Libraries
- WebView
- Native Bluetooth APIs
- Native Wi-Fi APIs

---

## Development Tools

- Node.js
- npm
- Gradle
- Python Virtual Environment
- PyInstaller

---

# Cross-Platform Design

One of the strongest aspects of the project is its cross-platform architecture.

```text
            React Application

                    │

                    ▼

            FastAPI Backend

                    ▲

                    │

           Android Application

                    │

                    ▼

         Native Hardware Access
```

Each platform performs tasks best suited to its capabilities.

| Platform | Primary Responsibility |
|----------|------------------------|
| React | User Interface & Experiment Visualization |
| FastAPI | Experiment Processing & APIs |
| Android | Hardware Communication |

---

# Educational Design

Each experiment follows the same educational workflow.

```text
Introduction

↓

Objective

↓

Theory

↓

Experiment

↓

Observation

↓

Analysis

↓

Conclusion
```

This consistent structure makes it easier for students to learn and compare different networking concepts.

---

# Performance Optimizations

Several engineering decisions improve application performance.

## Modular Services

Each experiment operates independently, reducing unnecessary dependencies.

---

## Hardware Abstraction

Hardware communication is isolated from business logic through repositories.

---

## Lightweight REST APIs

FastAPI provides asynchronous endpoints for efficient communication.

---

## Vite Development Server

Enables extremely fast frontend development with instant module replacement.

---

## Native Android APIs

Critical networking operations execute natively rather than through browser-based workarounds.

---

# Security

The application follows several best practices for safe operation.

### API Security

- Input Validation
- Structured Error Handling
- Request Validation
- Safe API Responses

---

### Android Security

- Runtime Permission Requests
- Controlled Hardware Access
- Scoped Bluetooth Operations
- Secure WebView Communication

---

### Browser Security

- CORS Configuration
- API Isolation
- Controlled Hardware Bridge
- Restricted Native Interface

---

# Scalability

The architecture has been designed so additional practical experiments can be introduced with minimal effort.

To add a new experiment, developers typically need to implement:

Frontend

- New React Page

Backend

- New FastAPI Service
- REST Endpoint

Android

- Native Hardware Integration (if required)

This modular approach enables future expansion without restructuring the existing codebase.

---

# Development Workflow

```text
Clone Repository

        │

        ▼

Frontend Development

        │

        ▼

Backend Development

        │

        ▼

Android Integration

        │

        ▼

Experiment Testing

        │

        ▼

Deployment
```

---

# Learning Outcomes

The project demonstrates practical implementation of several Computer Engineering concepts.

## Networking

- Wireless Communication
- Bluetooth Networking
- Wi-Fi Communication
- Network Performance Analysis
- Signal Propagation
- RF Interference

---

## Web Development

- React
- FastAPI
- REST APIs
- Frontend–Backend Communication

---

## Android Development

- Kotlin
- Android SDK
- WebView
- Hardware APIs
- Runtime Permissions

---

## Software Engineering

- Layered Architecture
- Repository Pattern
- Dependency Injection
- Modular Design
- Service-Oriented Architecture
- Cross-Platform Development

---

# Educational Benefits

Students using this virtual laboratory gain hands-on exposure to concepts that are otherwise difficult to demonstrate without specialized laboratory equipment.

The platform encourages:

- Practical Learning
- Interactive Experimentation
- Concept Visualization
- Independent Exploration
- Remote Laboratory Access

---

# Design Principles

The project is built around five core principles.

### Accessibility

Allow students to perform experiments using readily available devices.

---

### Practical Learning

Bridge the gap between theory and real-world networking concepts.

---

### Scalability

Support future practicals and networking modules without major architectural changes.

---

### Maintainability

Use modular software architecture for easier development and testing.

---

### Cross-Platform Compatibility

Deliver a consistent learning experience across web, desktop, and Android environments.

---

# Engineering Highlights

The project demonstrates several advanced engineering practices.

- Cross-Platform Architecture
- Native Android Integration
- FastAPI Service Layer
- Repository Pattern
- Dependency Injection
- Hardware Abstraction
- Modular React Components
- RESTful API Design
- Experiment-Based Module Isolation
- Offline Asset Support
- Educational Workflow Design
- Scalable Code Organization

---

# Screenshots

> **Note:** Replace these placeholders with screenshots from your application.

## Home Page

```text
docs/screenshots/home.png
```

---

## Practical Dashboard

```text
docs/screenshots/dashboard.png
```

---

## Wi-Fi Signal Analysis

```text
docs/screenshots/practical4.png
```

---

## Bluetooth Communication

```text
docs/screenshots/practical6.png
```

---

## Path Loss Simulation

```text
docs/screenshots/practical7.png
```

---

## Android Application

```text
docs/screenshots/android-app.png
```

---

# Real-World Applications

Although designed primarily as an educational platform, the technologies and architecture used in this project are directly applicable to real-world systems.

### Educational Institutions

- Engineering Colleges
- Universities
- Polytechnic Institutes
- Online Learning Platforms
- Remote Laboratory Programs

---

### Networking Research

- Wireless Signal Analysis
- Bluetooth Research
- Wi-Fi Performance Studies
- Propagation Analysis
- Network Optimization

---

### Industry

The architecture can be extended for:

- IoT Device Monitoring
- Smart Campus Solutions
- Indoor Positioning Systems
- Wireless Network Planning
- Bluetooth Asset Tracking

---

# Future Roadmap

The project has been designed with extensibility in mind, allowing additional experiments and features to be integrated with minimal architectural changes.

## Laboratory Expansion

- Practical 1–3 Implementation
- Additional WMC Experiments
- 5G Communication Experiments
- Software Defined Radio (SDR) Integration
- LoRa & ZigBee Experiments

---

## Advanced Visualizations

- Live RSSI Graphs
- Signal Heatmaps
- Interactive Coverage Maps
- Real-Time Spectrum Analysis
- Dynamic Path Loss Graphs

---

## Artificial Intelligence

Potential AI-powered features include:

- Automatic Signal Quality Analysis
- Intelligent Network Recommendations
- Predictive Performance Analysis
- AI-Based Experiment Feedback
- Automated Report Evaluation

---

## Mobile Enhancements

Future Android improvements may include:

- Native Experiment Dashboard
- Offline Experiment Reports
- Background Data Collection
- Sensor Integration
- Material Design 3 Interface

---

## Reporting System

Future reporting capabilities could include:

- Automatic PDF Report Generation
- Experiment History
- Student Progress Tracking
- Performance Analytics
- Instructor Dashboard

---

## Cloud Integration

Potential cloud features include:

- User Authentication
- Experiment Synchronization
- Cloud Data Storage
- Multi-Device Access
- Institution-Level Management

---

# Why This Project Stands Out

Unlike many educational simulations, this project combines multiple technologies into a single ecosystem.

It demonstrates expertise in:

- Modern Web Development
- Backend API Design
- Android Development
- Wireless Networking
- Bluetooth Programming
- Cross-Platform Software Engineering
- REST Architecture
- Hardware Integration

The combination of these technologies makes the project significantly more comprehensive than a traditional laboratory simulation.

---

# Educational Outcomes

Students using the platform gain practical experience in:

### Wireless Communication

- Wi-Fi Networks
- Bluetooth Communication
- Signal Propagation
- RF Interference
- Multipath Fading

---

### Software Engineering

- Modular Architecture
- REST APIs
- Cross-Platform Development
- Client-Server Communication
- Hardware Abstraction

---

### Mobile Development

- Android SDK
- Kotlin
- Native APIs
- Runtime Permissions
- WebView Integration

---

### Networking

- Signal Measurement
- Throughput Testing
- Latency Analysis
- Wireless Performance Evaluation

---

# Contributors

This project was collaboratively developed by:

- **Om Tawde**
- **Parth Varekar**
- **Ishwar Suthar**

Each contributor played an important role in the design, development, testing, and documentation of the Wireless & Mobile Communication Virtual Laboratory.

---

# Acknowledgements

This project builds upon several open-source technologies and educational resources.

Special thanks to the communities behind:

- React
- Vite
- FastAPI
- Python
- Kotlin
- Android SDK
- AndroidX
- Uvicorn

Their contributions make projects like this possible.

---

# License

This project is developed for educational, academic, and research purposes.

Unless otherwise specified, the project may be used for learning, experimentation, and demonstration in academic environments.

---

# Conclusion

The **Wireless & Mobile Communication Virtual Laboratory** is more than a collection of practical experiments—it is a complete cross-platform educational ecosystem that combines modern web technologies, native Android development, and backend services to deliver an engaging and accessible laboratory experience.

By integrating real hardware interaction with interactive visualizations, the platform bridges the gap between theoretical concepts and practical experimentation. Students are empowered to explore wireless communication principles through hands-on activities without relying on expensive laboratory equipment.

The modular architecture, clean separation of concerns, and scalable design ensure that the platform can continue to evolve as new technologies and experiments emerge, making it a valuable foundation for future academic innovation.

---

<p align="center">

### 📡 Learn • Experiment • Analyze • Innovate

**Empowering Wireless Communication Education Through Interactive Technology**

</p>
