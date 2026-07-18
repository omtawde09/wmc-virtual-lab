import cv2
import numpy as np

# Load the video
video_path = 'public/Dolly_push-in_to_phone_3.mp4'
cap = cv2.VideoCapture(video_path)

# Go to the last frame
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames - 2)
ret, frame = cap.read()

if ret:
    # Convert to grayscale
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # The phone screen is likely the darkest part (black) or we can find edges.
    # Let's run a simple edge detection or thresholding.
    # The background is dark, but the phone itself has a bright outline/bezel or screen contents.
    # Actually, in the screenshot the phone has a bright bezel and a very dark screen.
    # Let's save the frame to an image so I can check it if needed, but let's also find the bounding box of the bright bezel.
    
    # Apply Gaussian blur
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    # Edge detection
    edges = cv2.Canny(blur, 50, 150)
    
    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Find the largest contour which should be the phone
    if contours:
        largest_contour = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest_contour)
        print(f"Video Frame Size: {frame.shape[1]}x{frame.shape[0]}")
        print(f"Phone Bounding Box: x={x}, y={y}, width={w}, height={h}")
        print(f"Phone Aspect Ratio (Height/Width): {h/w:.3f}")
        print(f"Phone Scale (Width / Frame Width): {w/frame.shape[1]:.3f}")
        print(f"Phone Scale (Height / Frame Height): {h/frame.shape[0]:.3f}")
    else:
        print("No contours found.")
        
    cv2.imwrite('last_frame.jpg', frame)
else:
    print("Could not read the last frame.")

cap.release()
