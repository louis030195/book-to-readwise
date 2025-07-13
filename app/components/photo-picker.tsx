"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { SyntheticEvent, MouseEvent } from "react";
import {
  ExternalLink,
  Loader2,
  RefreshCw,
  CheckCircle,
  Clock,
  Filter,
  X,
} from "lucide-react";

interface PickedPhoto {
  id: string;
  baseUrl: string;
  filename: string;
  mimeType: string;
  creationTime?: string;
}

interface PhotoPickerProps {
  onPhotosSelected: (photos: PickedPhoto[]) => void;
  onPhotoClick: (photo: PickedPhoto) => void;
}

interface ExtractedText {
  fullText: string;
  confidence: number;
  isBookContent: boolean;
  suggestedBookTitle?: string;
  suggestedAuthor?: string;
  tags?: string[];
}

interface SelectedBook {
  id: string | null;
  title: string;
  author?: string;
}

interface CachedHighlight {
  imageId: string;
  extractedText: ExtractedText;
  selectedText: string;
  selectedBook: SelectedBook;
  customNote: string;
  tags: string[];
  savedToReadwise: boolean;
  savedBookId?: string;
  savedAt?: string;
}

interface GoogleMediaItem {
  id: string;
  mediaFile: {
    baseUrl: string;
    filename?: string;
    mimeType: string;
  };
  mediaMetadata?: {
    creationTime?: string;
  };
  creationTime?: string;
}

export function PhotoPicker({
  onPhotosSelected,
  onPhotoClick,
}: PhotoPickerProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pickerUri, setPickerUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [showUnsentOnly, setShowUnsentOnly] = useState(true);

  const getImageStatus = (imageId: string) => {
    try {
      const cached = localStorage.getItem(`highlight_${imageId}`);
      if (cached) {
        const data = JSON.parse(cached);
        return {
          processed: true,
          savedToReadwise: data.savedToReadwise || false,
          savedAt: data.savedAt,
        };
      }
    } catch (error) {
      console.error("Error checking image status:", error);
    }
    return { processed: false, savedToReadwise: false };
  };

  // Sort photos by creation time (newest first)
  const sortPhotosByDate = (photos: PickedPhoto[]) => {
    return [...photos].sort((a: PickedPhoto, b: PickedPhoto) => {
      const dateA = a.creationTime ? new Date(a.creationTime).getTime() : 0;
      const dateB = b.creationTime ? new Date(b.creationTime).getTime() : 0;
      return dateB - dateA; // Newest first
    });
  };

  // Filter photos based on the toggle
  const getFilteredPhotos = () => {
    const sortedPhotos = sortPhotosByDate(photos);
    if (showUnsentOnly) {
      return sortedPhotos.filter(
        (photo: PickedPhoto) => !getImageStatus(photo.id).savedToReadwise
      );
    }
    return sortedPhotos;
  };

  // Load cached photos on component mount
  useEffect(() => {
    // Add a small delay to ensure the component is fully mounted
    const loadCachedPhotos = () => {
      const cachedPhotos = localStorage.getItem("selectedPhotos");
      console.log("Checking for cached photos:", !!cachedPhotos);
      if (cachedPhotos) {
        try {
          const parsedPhotos = JSON.parse(cachedPhotos);
          console.log("Loading cached photos:", parsedPhotos.length);
          const sortedPhotos = sortPhotosByDate(parsedPhotos);
          setPhotos(sortedPhotos);
          onPhotosSelected(sortedPhotos);
          console.log("Cached photos loaded successfully");
        } catch (error) {
          console.error("Error loading cached photos:", error);
          localStorage.removeItem("selectedPhotos");
        }
      } else {
        console.log("No cached photos found");
      }
    };

    // Load cached photos after a brief delay
    const timer = setTimeout(loadCachedPhotos, 100);
    return () => clearTimeout(timer);
  }, []); // Remove onPhotosSelected dependency to avoid infinite loops

  // Save photos to cache whenever photos change
  useEffect(() => {
    if (photos.length > 0) {
      localStorage.setItem("selectedPhotos", JSON.stringify(photos));
      console.log("Cached photos:", photos.length);
    }
  }, [photos]);

  // Background text extraction for newly added photos
  useEffect(() => {
    // Helper to check if a photo already has cached highlight
    const isPhotoProcessed = (photoId: string) => {
      try {
        return localStorage.getItem(`highlight_${photoId}`) !== null;
      } catch {
        return false;
      }
    };

    // Extract text and cache for a single photo
    const extractAndCacheText = async (photo: PickedPhoto) => {
      if (isPhotoProcessed(photo.id)) return; // nothing to do
      try {
        const imageUrl = `${photo.baseUrl}=w1024-h1024-c`;
        const resp = await fetch("/api/extract-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl }),
        });
        if (!resp.ok) {
          console.error("Failed to extract text for photo", photo.id, resp.status);
          return;
        }
        const data: ExtractedText = await resp.json();

        const highlightData: CachedHighlight = {
          imageId: photo.id,
          extractedText: data,
          selectedText: data.fullText || "",
          selectedBook:
            data.isBookContent && data.suggestedBookTitle
              ? {
                  id: null,
                  title: data.suggestedBookTitle,
                  author: data.suggestedAuthor || "",
                }
              : { id: null, title: "" },
          customNote: "",
          tags: data.tags || [],
          savedToReadwise: false,
        };

        localStorage.setItem(
          `highlight_${photo.id}`,
          JSON.stringify(highlightData)
        );
        // Force a re-render so status indicators update
        setPhotos((prev: PickedPhoto[]) => [...prev]);
      } catch (err) {
        console.error("Error during background extraction for", photo.id, err);
      }
    };

    // Kick off extraction for any photos that are not yet processed
    photos.forEach((p: PickedPhoto) => {
      if (!isPhotoProcessed(p.id)) {
        extractAndCacheText(p);
      }
    });
  }, [photos]);

  const clearCache = () => {
    localStorage.removeItem("selectedPhotos");
    setPhotos([]);
    onPhotosSelected([]);
    alert("Photo cache cleared!");
  };

  const createSession = async () => {
    setLoading(true);
    try {
      let response = await fetch("/api/google-photos-picker/session", {
        method: "POST",
      });

      // If session creation fails with 401, try to refresh the token
      if (response.status === 401) {
        console.log(
          "Session creation failed with 401, attempting token refresh..."
        );
        const refreshResponse = await fetch("/api/auth/google/refresh", {
          method: "POST",
        });

        if (refreshResponse.ok) {
          console.log(
            "Token refreshed successfully, retrying session creation..."
          );
          // Retry session creation after token refresh
          response = await fetch("/api/google-photos-picker/session", {
            method: "POST",
          });
        } else {
          throw new Error(
            "Authentication expired. Please refresh the page and sign in again."
          );
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create picker session");
      }

      const sessionData = await response.json();
      setSessionId(sessionData.id);
      setPickerUri(sessionData.pickerUri);
    } catch (error) {
      console.error("Error creating picker session:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to create picker session. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const pollSession = async () => {
    if (!sessionId) return;

    setPolling(true);
    try {
      console.log("Polling session:", sessionId);
      const response = await fetch(
        `/api/google-photos-picker/media-items?sessionId=${sessionId}`
      );

      console.log("Poll response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log("Poll error data:", errorData);

        if (errorData.needsSelection) {
          // User hasn't selected photos yet
          alert(
            "Please select photos in the Google Photos Picker first, then come back and click 'Check for Selected Photos'"
          );
          return;
        }

        throw new Error(errorData.error || "Failed to fetch selected photos");
      }

      const mediaData = await response.json();
      console.log("Media data received:", mediaData);

      if (mediaData.mediaItems && mediaData.mediaItems.length > 0) {
        const selectedPhotos: PickedPhoto[] = mediaData.mediaItems.map(
          (item: GoogleMediaItem) => ({
            id: item.id,
            baseUrl: item.mediaFile.baseUrl,
            filename: item.mediaFile.filename || `photo_${item.id}`,
            mimeType: item.mediaFile.mimeType,
            creationTime: item.mediaMetadata?.creationTime || item.creationTime,
          })
        );

        console.log("Selected photos:", selectedPhotos);

        // Filter for likely document/book photos (aspect ratio close to paper)
        const documentPhotos = selectedPhotos.filter((photo: PickedPhoto) => {
          // This is a basic filter - you might want to add more sophisticated filtering
          return photo.mimeType.startsWith("image/");
        });

        setPhotos((prevPhotos: PickedPhoto[]) => {
          const existingPhotoIds = new Set(
            prevPhotos.map((p: PickedPhoto) => p.id)
          );
          const photosToAdd = documentPhotos.filter(
            (p: PickedPhoto) => !existingPhotoIds.has(p.id)
          );

          if (photosToAdd.length === 0) {
            alert("All selected photos have already been added.");
            return prevPhotos;
          }

          const updatedPhotos = [...prevPhotos, ...photosToAdd];
          onPhotosSelected(updatedPhotos);
          alert(
            `Successfully added ${photosToAdd.length} new photos! Total: ${updatedPhotos.length}`
          );
          return updatedPhotos;
        });
      } else {
        console.log("No photos found in response");
        alert(
          "No photos were selected. Please try selecting photos in the Google Photos Picker."
        );
      }
    } catch (error) {
      console.error("Error polling session:", error);
      alert(`Error: ${error}`);
    } finally {
      setPolling(false);
    }
  };

  const openPhotoPicker = () => {
    if (pickerUri) {
      window.open(pickerUri, "_blank");
    }
  };

  const selectMorePhotos = async () => {
    setLoading(true);
    try {
      // Create a new session
      let response = await fetch("/api/google-photos-picker/session", {
        method: "POST",
      });

      // If session creation fails with 401, try to refresh the token
      if (response.status === 401) {
        console.log(
          "Session creation failed with 401, attempting token refresh..."
        );
        const refreshResponse = await fetch("/api/auth/google/refresh", {
          method: "POST",
        });

        if (refreshResponse.ok) {
          console.log(
            "Token refreshed successfully, retrying session creation..."
          );
          // Retry session creation after token refresh
          response = await fetch("/api/google-photos-picker/session", {
            method: "POST",
          });
        } else {
          throw new Error(
            "Authentication expired. Please refresh the page and sign in again."
          );
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create picker session");
      }

      const sessionData = await response.json();
      setSessionId(sessionData.id);
      setPickerUri(sessionData.pickerUri);

      // Automatically open the picker
      if (sessionData.pickerUri) {
        window.open(sessionData.pickerUri, "_blank");
      }
    } catch (error) {
      console.error("Error creating picker session:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to create picker session. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const deletePhoto = (photoId: string) => {
    console.log("Deleting photo:", photoId);
    const updatedPhotos = photos.filter((photo: PickedPhoto) => photo.id !== photoId);
    setPhotos(updatedPhotos);

    // Update cache
    localStorage.setItem("selectedPhotos", JSON.stringify(updatedPhotos));

    // Update parent component
    onPhotosSelected(updatedPhotos);

    console.log(
      `Photo ${photoId} deleted. Remaining photos:`,
      updatedPhotos.length
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Book Photos from Google Photos</CardTitle>
          <p className="text-sm text-gray-600">
            Choose photos of book pages, documents, or handwritten notes that
            you want to extract text from and sync to Readwise.
          </p>
          {photos.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
              <p className="text-sm text-green-800">
                ✅ {photos.length} photos loaded{" "}
                {localStorage.getItem("selectedPhotos") ? "(cached)" : ""}
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {photos.length === 0 ? (
            <>
              {!sessionId ? (
                <Button
                  onClick={createSession}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    "Start Photo Selection"
                  )}
                </Button>
              ) : (
                <div className="space-y-4">
                  <Button
                    onClick={openPhotoPicker}
                    className="w-full"
                    disabled={!pickerUri}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Google Photos Picker
                  </Button>

                  <p className="text-sm text-gray-600 text-center">
                    Click the button above to select photos of book pages,
                    documents, or notes from your Google Photos library. After
                    selecting your book photos, come back here and click "Check
                    for Selected Photos".
                  </p>

                  <Button
                    onClick={pollSession}
                    disabled={polling}
                    variant="outline"
                    className="w-full"
                  >
                    {polling ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Check for Selected Photos
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={selectMorePhotos}
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  {loading ? "Creating Session..." : "Select More Photos"}
                </Button>

                <Button
                  onClick={clearCache}
                  variant="outline"
                  className="w-full"
                >
                  Clear All Photos
                </Button>
              </div>

              {sessionId && pickerUri && (
                <Button
                  onClick={pollSession}
                  disabled={polling}
                  variant="outline"
                  className="w-full"
                >
                  {polling ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Check for New Photos
                </Button>
              )}

              <p className="text-sm text-gray-600 text-center">
                Your selected photos are cached locally. Click "Select More
                Photos" to add more from Google Photos, or click on any photo
                below to extract text.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Selected Photos ({getFilteredPhotos().length}
              {showUnsentOnly && ` of ${photos.length}`})
            </CardTitle>
            <div className="flex flex-col gap-3">
              <div className="flex gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span>
                    {
                      photos.filter(
                        (photo: PickedPhoto) => getImageStatus(photo.id).processed
                      ).length
                    }{" "}
                    processed
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>
                    {
                      photos.filter(
                        (photo: PickedPhoto) => getImageStatus(photo.id).savedToReadwise
                      ).length
                    }{" "}
                    saved to Readwise
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="unsent-only"
                  checked={showUnsentOnly}
                  onCheckedChange={setShowUnsentOnly}
                />
                <Label htmlFor="unsent-only" className="text-sm">
                  <Filter className="h-4 w-4 inline mr-1" />
                  Show only unsent photos
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {getFilteredPhotos().map((photo: PickedPhoto) => {
                const status = getImageStatus(photo.id);
                return (
                  <div key={photo.id} className="relative group">
                    <div className="w-full h-32 bg-gray-200 rounded-lg cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center relative">
                      <img
                        src={`/api/proxy-image?url=${encodeURIComponent(
                          photo.baseUrl + "=w300-h300-c"
                        )}`}
                        alt={photo.filename}
                        className="w-full h-full object-cover rounded-lg"
                        onClick={() => onPhotoClick(photo)}
                        onError={(e: SyntheticEvent<HTMLImageElement, Event>) => {
                          const img = e.target as HTMLImageElement;
                          // Show a placeholder with photo info
                          img.style.display = "none";
                          const parent = img.parentElement;
                          if (parent) {
                            parent.innerHTML = `
                              <div class="w-full h-full flex flex-col items-center justify-center text-gray-500 text-xs p-2">
                                <div class="w-8 h-8 bg-gray-300 rounded mb-1"></div>
                                <div class="text-center">
                                  <div class="font-medium">${photo.filename}</div>
                                  <div class="text-gray-400">${photo.mimeType}</div>
                                </div>
                              </div>
                            `;
                          }
                        }}
                      />

                      {/* Status indicators */}
                      <div className="absolute top-2 right-2 flex gap-1">
                        {status.processed && (
                          <div
                            className="bg-blue-500 text-white rounded-full p-1"
                            title="Processed"
                          >
                            <Clock className="h-3 w-3" />
                          </div>
                        )}
                        {status.savedToReadwise && (
                          <div
                            className="bg-green-500 text-white rounded-full p-1"
                            title="Saved to Readwise"
                          >
                            <CheckCircle className="h-3 w-3" />
                          </div>
                        )}
                      </div>

                      {/* Delete button - appears on hover */}
                      <button
                        onClick={(e: MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          deletePhoto(photo.id);
                        }}
                        className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                        title="Remove photo from list"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {photo.filename}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {photo.mimeType}
                    </p>
                    {photo.creationTime && (
                      <p className="text-xs text-gray-400 truncate">
                        📅 {new Date(photo.creationTime).toLocaleDateString()}
                      </p>
                    )}
                    {status.savedToReadwise && status.savedAt && (
                      <p className="text-xs text-green-600 truncate">
                        ✅ Saved {new Date(status.savedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
