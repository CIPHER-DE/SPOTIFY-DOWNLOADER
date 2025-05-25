import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Link as LinkIcon, CheckCircle, Info, Smartphone, FileText, Music, ArrowDownCircle, History, Trash2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import SpotifyUrlForm from '@/components/homepage/SpotifyUrlForm';
import SongDisplay from '@/components/homepage/SongDisplay';
import LoadingIndicator from '@/components/homepage/LoadingIndicator';
import ErrorMessage from '@/components/homepage/ErrorMessage';
import { Button } from '@/components/ui/button';

const MAX_HISTORY_ITEMS = 5;
const LOCAL_STORAGE_KEY = 'spotifyDlHistory';

const HomePage = () => {
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [songData, setSongData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadHistory, setDownloadHistory] = useState([]);
  const { toast } = useToast();
  const appDownloadSectionRef = useRef(null);

  const API_BASE_URL = 'https://apis.davidcyriltech.my.id/spotifydl?url=';
  const APP_DOWNLOAD_URL = 'https://www.mediafire.com/file/c258ri21spt535j/Spotify+downloader.apk/file';

  useEffect(() => {
    const storedHistory = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    setDownloadHistory(storedHistory);
  }, []);

  const updateDownloadHistory = (newSongData, originalUrl) => {
    const newHistoryItem = {
      title: newSongData.title,
      artist: newSongData.channel || 'N/A',
      thumbnail: newSongData.thumbnail,
      spotifyUrl: originalUrl, 
      timestamp: new Date().toISOString(),
    };

    setDownloadHistory(prevHistory => {
      const updatedHistory = [newHistoryItem, ...prevHistory.filter(item => item.spotifyUrl !== originalUrl)].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedHistory));
      return updatedHistory;
    });
  };

  const clearDownloadHistory = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setDownloadHistory([]);
    toast({ title: 'History Cleared', description: 'Your download history has been removed.', icon: <Trash2 className="text-spotify-green" /> });
  };

  const handleHistoryItemClick = (itemSpotifyUrl) => {
    setSpotifyUrl(itemSpotifyUrl);
    toast({ title: 'URL Loaded from History', description: 'Press "Fetch Song" to get details.', icon: <RefreshCw className="text-spotify-green" /> });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cleanSpotifyUrl = (url) => {
    try {
      const parsedUrl = new URL(url);
      // Reconstruct without query parameters or hash
      return `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
    } catch (e) {
      return url; // Return original if parsing fails, though isValidSpotifyTrackUrl should catch most issues
    }
  };

  const isValidSpotifyTrackUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    try {
      // Use the cleaned URL for validation as well, to be consistent
      const cleanedForValidation = cleanSpotifyUrl(url);
      const parsedUrl = new URL(cleanedForValidation);
      const pathSegments = parsedUrl.pathname.split('/').filter(segment => segment.length > 0);
      
      const isValidHostname = parsedUrl.hostname === 'open.spotify.com' || parsedUrl.hostname === 'spotify.com';
      if (!isValidHostname) return false;

      const trackIndex = pathSegments.findIndex(segment => segment === 'track');
      
      return trackIndex !== -1 && pathSegments.length > trackIndex + 1 && pathSegments[trackIndex+1].length > 0;

    } catch (e) {
      return false;
    }
  };

  const fetchSongData = async (urlToFetch) => {
    // Validate before cleaning, so user sees the URL they pasted if it's invalid initially
    if (!isValidSpotifyTrackUrl(urlToFetch)) {
      setError('Please enter a valid Spotify song URL. It should point directly to a track (e.g., https://open.spotify.com/track/...). Album or playlist links are not supported.');
      toast({ variant: 'destructive', title: 'Invalid URL Format', description: 'Ensure you are using a direct Spotify song track URL.' });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSongData(null);

    const cleanedUrl = cleanSpotifyUrl(urlToFetch); // Clean the URL before sending to API

    try {
      const response = await fetch(`${API_BASE_URL}${encodeURIComponent(cleanedUrl)}`);
      
      let responseData;
      try {
        responseData = await response.json();
      } catch (jsonError) {
        console.error("API returned non-JSON:", response.status, await response.text().catch(()=>""));
        throw new Error(`The API returned an unexpected response (Status: ${response.status}). Please try again later.`);
      }

      if (!response.ok) {
        throw new Error(responseData.message || `Failed to fetch song data. API Status: ${response.status}`);
      }
      
      if (responseData.success && responseData.title && responseData.DownloadLink) {
        setSongData(responseData);
        // Store the original URL (with query params) in history for accuracy, 
        // but the cleaned one was used for fetching
        updateDownloadHistory(responseData, urlToFetch); 
        toast({ 
          title: 'Song Found!', 
          description: responseData.title,
          action: <CheckCircle className="text-spotify-green" />
        });
      } else {
        throw new Error(responseData.message || 'Could not retrieve song information. The API might be down, the link invalid, or the song not downloadable via this service.');
      }
    } catch (err) {
      console.error("API Error:", err);
      let errorMessage = err.message || 'An unexpected error occurred while fetching song data.';
      if (errorMessage.includes("Status: 404") || errorMessage.toLowerCase().includes("not found")) {
        errorMessage = "Song not found or link is invalid. Please double-check the Spotify URL.";
      } else if (errorMessage.includes("Status: 5")) { 
        errorMessage = "The download service is temporarily unavailable. Please try again later.";
      }
      setError(errorMessage);
      toast({ variant: 'destructive', title: 'Fetch Error', description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!spotifyUrl) {
      setError('Please paste a Spotify song URL.');
      toast({ variant: 'destructive', title: 'Input Required', description: 'Spotify URL cannot be empty.' });
      return;
    }
    fetchSongData(spotifyUrl);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSpotifyUrl(text);
        toast({ 
          title: 'Pasted from clipboard!', 
          description: 'URL populated from clipboard.',
          action: <CheckCircle className="text-spotify-green" />
        });
      } else {
        toast({ variant: 'destructive', title: 'Clipboard Empty', description: 'Nothing to paste from clipboard.'});
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
      toast({ variant: 'destructive', title: 'Paste Error', description: 'Could not read from clipboard. Check permissions.'});
    }
  };
  
  const checkClipboardOnFocus = useCallback(async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        if (text && isValidSpotifyTrackUrl(text) && spotifyUrl === '') { 
          toast({
            title: 'Spotify Link Detected!',
            description: (
              <div>
                <p className="mb-2">We found a Spotify link in your clipboard:</p>
                <p className="text-xs bg-spotify-gray p-2 rounded break-all mb-3">{text}</p>
                <p>Would you like to paste it into the input field?</p>
              </div>
            ),
            duration: 10000, 
            action: (
              <Button 
                variant="outline" 
                className="bg-spotify-green text-spotify-black hover:bg-spotify-green/90"
                onClick={() => {
                  setSpotifyUrl(text);
                  toast({ title: 'Pasted!', description: 'Link pasted from clipboard detection.', action: <CheckCircle className="text-spotify-green" /> });
                }}
              >
                Paste Link
              </Button>
            ),
            icon: <Info className="text-spotify-green" />
          });
        }
      }
    } catch (err) {
      if (err.name !== 'NotAllowedError' && err.name !== 'SecurityError' && document.hasFocus()) {
         console.warn('Clipboard read on focus failed:', err.message);
      }
    }
  }, [spotifyUrl, toast]);


  useEffect(() => {
    if (document.hasFocus()) {
        checkClipboardOnFocus();
    }
    window.addEventListener('focus', checkClipboardOnFocus);
    return () => {
      window.removeEventListener('focus', checkClipboardOnFocus);
    };
  }, [checkClipboardOnFocus]);

  const scrollToAppDownload = () => {
    appDownloadSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5 } }
  };

  return (
    <motion.div 
      className="container mx-auto px-4 py-8 flex flex-col items-center min-h-[calc(100vh-160px)] " 
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 }}}}
    >
      <motion.div 
        variants={itemVariants}
        className="w-full max-w-2xl text-center mb-6"
      >
        <button 
          onClick={scrollToAppDownload} 
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-spotify-green bg-spotify-gray/60 border border-spotify-green/30 rounded-full hover:bg-spotify-gray/80 transition-colors duration-200 cursor-pointer shadow-md"
        >
          <ArrowDownCircle className="w-5 h-5 mr-2 animate-bounce" />
          Scroll down to download our app if needed
        </button>
      </motion.div>

      <motion.section variants={itemVariants} className="text-center mb-10">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4">
          <span className="text-spotify-green">Spotify Song Downloader</span>
        </h1>
        <p className="text-xl text-spotify-light-gray max-w-2xl mx-auto">
          Paste your Spotify song link below to get the download link. Fast, free, and easy.
        </p>
      </motion.section>

      <motion.section variants={itemVariants} className="w-full max-w-2xl mb-12">
        <Card className="glassmorphic shadow-2xl border-spotify-green/30 bg-spotify-gray/70">
          <CardHeader>
            <CardTitle className="text-3xl text-center flex items-center justify-center text-spotify-green">
              <LinkIcon className="mr-3 h-8 w-8" /> Get Your Song
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SpotifyUrlForm
              spotifyUrl={spotifyUrl}
              setSpotifyUrl={setSpotifyUrl}
              handleSubmit={handleSubmit}
              handlePaste={handlePasteFromClipboard}
              isLoading={isLoading}
              handleFocus={checkClipboardOnFocus}
            />
          </CardContent>
        </Card>
      </motion.section>

      <AnimatePresence>
        {isLoading && !error && !songData && <LoadingIndicator />}
      </AnimatePresence>
      
      <AnimatePresence>
        {error && <ErrorMessage error={error} />}
      </AnimatePresence>

      <AnimatePresence>
        {songData && !error && <SongDisplay songData={songData} />}
      </AnimatePresence>

      {downloadHistory.length > 0 && (
        <motion.section 
          variants={itemVariants} 
          className="w-full max-w-3xl mt-12 mb-8 p-6 glassmorphic rounded-xl shadow-2xl border-spotify-green/30 bg-spotify-gray/70"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-spotify-green flex items-center">
              <History className="mr-3 h-7 w-7" /> Your Recent Downloads
            </h2>
            <Button variant="ghost" size="sm" onClick={clearDownloadHistory} className="text-spotify-light-gray hover:text-spotify-green">
              <Trash2 className="mr-2 h-4 w-4" /> Clear History
            </Button>
          </div>
          <div className="space-y-3">
            {downloadHistory.map((item, index) => (
              <motion.div
                key={item.timestamp + index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 bg-spotify-black/50 rounded-lg hover:bg-spotify-black/70 transition-colors cursor-pointer"
                onClick={() => handleHistoryItemClick(item.spotifyUrl)}
              >
                <div className="flex items-center">
                  {item.thumbnail && (
                    <img-replace src={item.thumbnail} alt={item.title} className="w-10 h-10 rounded mr-3 object-cover border border-spotify-green/30" />
                  )}
                  <div>
                    <p className="font-semibold text-spotify-light-gray text-sm">{item.title}</p>
                    <p className="text-xs text-spotify-light-gray/70">{item.artist}</p>
                  </div>
                </div>
                <RefreshCw className="h-5 w-5 text-spotify-green/70 hover:text-spotify-green" title="Reload this URL" />
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      <motion.section 
        ref={appDownloadSectionRef}
        variants={itemVariants} 
        className="w-full max-w-3xl mt-12 mb-8 p-6 glassmorphic rounded-xl shadow-2xl border-spotify-green/30 bg-spotify-gray/70 scroll-mt-20"
      >
        <h2 className="text-3xl font-bold text-spotify-green mb-6 text-center">
          How to Use & Download Our App
        </h2>
        <div className="space-y-4 text-spotify-light-gray/90 text-left">
          <div className="flex items-start">
            <Music className="h-6 w-6 mr-3 mt-1 text-spotify-green flex-shrink-0" />
            <p><strong>Playing Downloaded Music:</strong> After downloading, check your device's default music player. The song should appear there automatically.</p>
          </div>
          <div className="flex items-start">
            <FileText className="h-6 w-6 mr-3 mt-1 text-spotify-green flex-shrink-0" />
            <p><strong>If Not Found:</strong> Navigate to your device's file manager. Look for a folder named "Spotify Downloader" (or your browser's default download folder). Your music file will be there.</p>
          </div>
          <div className="flex items-start">
            <Info className="h-6 w-6 mr-3 mt-1 text-spotify-green flex-shrink-0" />
            <p><strong>File Extension:</strong> If the file has a <code>.bin</code> extension, simply rename it to <code>.mp3</code>. This will allow your music player to recognize and play it.</p>
          </div>
        </div>
        <div className="mt-8 text-center">
          <Button
            asChild
            className="text-lg py-4 px-8 bg-spotify-green hover:bg-spotify-green/90 text-spotify-black font-bold rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-200 hover-glow"
          >
            <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
              <Smartphone className="mr-3 h-6 w-6" /> Download Android App (.apk)
            </a>
          </Button>
          <p className="text-xs text-spotify-light-gray/70 mt-3">
            (Note: You may need to enable "Install from Unknown Sources" in your Android settings.)
          </p>
        </div>
      </motion.section>

    </motion.div>
  );
};

export default HomePage;
