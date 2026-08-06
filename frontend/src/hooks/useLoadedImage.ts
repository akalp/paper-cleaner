import { useEffect, useState } from "react";

export interface LoadedImageState {
  hasError: boolean;
  image: HTMLImageElement | null;
  loadedUrl: string | null;
}

export function useLoadedImage(url: string): LoadedImageState {
  const [state, setState] = useState<LoadedImageState>({
    image: null,
    hasError: false,
    loadedUrl: null,
  });

  useEffect(() => {
    let isMounted = true;
    const image = new window.Image();

    image.onload = () => {
      if (!isMounted) {
        return;
      }

      setState({
        image,
        hasError: false,
        loadedUrl: url,
      });
    };

    image.onerror = () => {
      if (!isMounted) {
        return;
      }

      setState({
        image: null,
        hasError: true,
        loadedUrl: url,
      });
    };

    image.src = url;

    return () => {
      isMounted = false;
    };
  }, [url]);

  return state;
}
