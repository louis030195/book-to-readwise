"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PhotoPicker } from "./components/photo-picker";
import { TextExtractor } from "./components/text-extractor";
import { GooglePhotosAuth } from "./components/google-photos-auth";
import { Loader2 } from "lucide-react";

interface Photo {
  id: string;
  baseUrl: string;
  filename: string;
  mimeType: string;
}

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();

    // Check for auth success in URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("auth") === "success") {
      setIsAuthenticated(true);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check if we have the authentication cookie
      const authCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("google_authenticated="));

      if (authCookie) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthSuccess = async () => {
    setIsAuthenticated(true);
  };

  const handlePhotosSelected = (photos: Photo[]) => {
    setAllPhotos(photos);
    console.log("Photos updated in main page:", photos.length);
  };

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  const handleBackToGallery = () => {
    setSelectedPhoto(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Checking authentication...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-2xl font-bold mb-4">Photo Notes Extractor</h1>
            <p className="text-gray-600 mb-6">
              Connect your Google Photos to start extracting book highlights and
              notes
            </p>
            <GooglePhotosAuth onAuthSuccess={handleAuthSuccess} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedPhoto) {
    return <TextExtractor photo={selectedPhoto} onBack={handleBackToGallery} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Photo Notes</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PhotoPicker
          onPhotosSelected={handlePhotosSelected}
          onPhotoClick={handlePhotoClick}
        />
      </main>
    </div>
  );
}
