
"use strict";

const CACHE_NAME = "snapjournal-tier1-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("snapjournal-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle same-origin GET requests.
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Do not cache browser extension or unrelated requests.
  if (!url.pathname.includes("/snapjournal/")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseCopy);
          });
        }
        return response;
      });
    }).catch(async () => {
      if (request.mode === "navigate") {
        return caches.match("./index.html");
      }
      throw new Error("Không có bản lưu offline cho tài nguyên này.");
    })
  );
});
