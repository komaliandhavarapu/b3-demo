(() => {
  if (window.siteNavigationReady) return;
  window.siteNavigationReady = true;

  const musicButton = document.getElementById("music");
  const audio = document.createElement("audio");
  audio.id = "audio";
  audio.loop = true;
  audio.preload = "auto";
  audio.setAttribute("playsinline", "");
  audio.src = new URL(customer.music || "music/birthday.mp3", location.href).href;
  document.body.appendChild(audio);
  const loadingIndicator = document.createElement("div");
  loadingIndicator.className = "page-loading";
  loadingIndicator.setAttribute("role", "status");
  loadingIndicator.setAttribute("aria-live", "polite");
  loadingIndicator.setAttribute("aria-label", "Loading the next page");
  loadingIndicator.hidden = true;
  loadingIndicator.dataset.persistent = "";
  loadingIndicator.innerHTML = '<span class="page-loading__spinner" aria-hidden="true"></span><span>Opening the next page…</span>';
  document.body.appendChild(loadingIndicator);
  let musicPausedByUser = false;
  let navigationPending = false;

  const navigationScript = document.currentScript;
  const pageCache = new Map();
  [musicButton, audio, navigationScript].forEach(element => {
    if (element) element.dataset.persistent = "";
  });

  const updateMusicButton = () => {
    if (!musicButton) return;
    musicButton.textContent = audio.paused ? "♫ Play music" : "♫ Pause music";
    musicButton.setAttribute("aria-pressed", String(!audio.paused));
  };

  musicButton?.addEventListener("click", async () => {
    if (audio.paused) {
      musicPausedByUser = false;
      try {
        await audio.play();
      } catch (error) {
        console.error("Music could not be played.", error);
      }
    } else {
      musicPausedByUser = true;
      audio.pause();
    }
    updateMusicButton();
  });
  audio.addEventListener("play", updateMusicButton);
  audio.addEventListener("pause", updateMusicButton);
  audio.addEventListener("error", () => {
    console.error("The configured music file could not be loaded.", audio.error);
  });
  updateMusicButton();

  function loadPage(url) {
    const key = url.href;
    if (pageCache.has(key)) return pageCache.get(key);

    const pagePromise = (async () => {
      const response = await fetch(url.href);
      if (!response.ok) {
        throw new Error(`Page request failed: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const nextDocument = new DOMParser().parseFromString(html, "text/html");
      const nextScripts = [...nextDocument.body.querySelectorAll("script")];
      nextScripts.forEach(script => script.remove());
      nextDocument.getElementById("music")?.remove();

      const scriptUrls = [...new Set(nextScripts
        .map(script => script.getAttribute("src"))
        .filter(Boolean)
        .map(source => new URL(source, url))
        .filter(scriptUrl => !scriptUrl.pathname.endsWith("/config.js") && !scriptUrl.pathname.endsWith("/app.js"))
        .map(scriptUrl => scriptUrl.href))];
      const scriptEntries = await Promise.all(scriptUrls.map(async scriptUrl => {
        const scriptResponse = await fetch(scriptUrl);
        if (!scriptResponse.ok) {
          throw new Error(`Script request failed: ${scriptResponse.status} ${scriptResponse.statusText} (${scriptUrl})`);
        }
        return [scriptUrl, await scriptResponse.text()];
      }));

      return { nextDocument, nextScripts, scriptContents: new Map(scriptEntries) };
    })();

    pageCache.set(key, pagePromise);
    pagePromise.catch(() => {
      if (pageCache.get(key) === pagePromise) pageCache.delete(key);
    });
    return pagePromise;
  }

  function preloadPage(url) {
    loadPage(url).catch(error => {
      console.warn("Page preloading failed; it will be loaded when requested.", error);
    });
  }

  async function renderPage(url, addHistoryEntry) {
    const { nextDocument, nextScripts, scriptContents } = await loadPage(url);

    if (addHistoryEntry) history.pushState({}, "", url);

    document.title = nextDocument.title;
    const desiredHeadLinks = [...nextDocument.head.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]')];
    const desiredLinkKeys = new Set(desiredHeadLinks.map(link => `${link.rel}|${new URL(link.getAttribute("href"), url).href}`));
    document.head.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]').forEach(link => {
      if (!desiredLinkKeys.has(`${link.rel}|${link.href}`)) link.remove();
    });
    desiredHeadLinks.forEach(link => {
      const href = new URL(link.getAttribute("href"), url).href;
      const exists = [...document.head.querySelectorAll(`link[rel="${link.rel}"]`)]
        .some(currentLink => currentLink.href === href);
      if (!exists) document.head.appendChild(link.cloneNode(true));
    });
    document.head.querySelectorAll("style").forEach(style => style.remove());
    nextDocument.head.querySelectorAll("style").forEach(style => {
      document.head.appendChild(style.cloneNode(true));
    });

    const persistentElements = new Set([...document.body.querySelectorAll("[data-persistent]")]);
    [...document.body.childNodes].forEach(node => {
      if (!persistentElements.has(node)) node.remove();
    });
    document.body.className = nextDocument.body.className;
    const firstPersistentElement = document.body.firstChild;
    [...nextDocument.body.childNodes].forEach(node => {
      document.body.insertBefore(node.cloneNode(true), firstPersistentElement);
    });

    for (const sourceScript of nextScripts) {
      const source = sourceScript.getAttribute("src");
      if (source && new URL(source, url).pathname.endsWith("/config.js")) continue;
      if (source && new URL(source, url).pathname.endsWith("/app.js")) continue;

      const code = source
        ? scriptContents.get(new URL(source, url).href)
        : sourceScript.textContent;

      if (typeof code !== "string") {
        throw new Error(`Page script could not be loaded: ${source || url.href}`);
      }
      if (!code.trim()) continue;
      const script = document.createElement("script");
      const sourceLabel = source ? new URL(source, url).href : url.href;
      script.textContent = `(function(){\n${code}\n})();\n//# sourceURL=${sourceLabel}`;
      document.body.appendChild(script);
      script.remove();
    }

    updateMusicButton();
    window.scrollTo(0, 0);
    scheduleWarmup();
  }

  function warmNextPages() {
    document.querySelectorAll("a[href]").forEach(link => {
      const url = new URL(link.href, location.href);
      if (url.origin === location.origin && /\.html$/i.test(url.pathname)) preloadPage(url);
    });
  }

  function preloadFromLinkEvent(event) {
    const link = event.target.closest("a[href]");
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && /\.html$/i.test(url.pathname)) preloadPage(url);
  }

  function scheduleWarmup() {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(warmNextPages, { timeout: 250 });
    } else {
      window.setTimeout(warmNextPages, 0);
    }
  }

  async function navigate(url, addHistoryEntry) {
    if (navigationPending) return;
    navigationPending = true;
    const loadingTimer = window.setTimeout(() => {
      loadingIndicator.hidden = false;
    }, 180);
    try {
      await renderPage(url, addHistoryEntry);
    } catch (error) {
      console.error("In-page navigation failed; loading the page normally.", error);
      location.assign(url.href);
    } finally {
      window.clearTimeout(loadingTimer);
      loadingIndicator.hidden = true;
      navigationPending = false;
    }
  }

  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !/\.html$/i.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;

    if (audio.paused && !musicPausedByUser) {
      audio.play().catch(error => {
        console.error("Music could not be played.", error);
      });
    }

    event.preventDefault();
    navigate(url, true);
  });

  document.addEventListener("pointerover", preloadFromLinkEvent);
  document.addEventListener("pointerdown", preloadFromLinkEvent);
  document.addEventListener("focusin", preloadFromLinkEvent);

  window.addEventListener("popstate", () => {
    navigate(new URL(location.href), false);
  });

  scheduleWarmup();
})();
