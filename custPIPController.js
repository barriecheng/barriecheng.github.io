// 20260813 Jenson PIP Subtitle render fix
// 以精簡自訂控制列建立硬體解碼 Document Picture-in-Picture，並搬移同一個 video 與既有字幕 DOM。
(function setupCustomDocumentPipController() {
  'use strict';

  const PIP_BUTTON_SELECTOR = '[data-plyr="pip"]';
  const PLAYER_SELECTOR = '.plyr';
  const VIDEO_SELECTOR = 'video';
  const CUSTOM_PIP_HOST_CLASS = 'hami-custom-document-pip-host';
  const CUSTOM_PIP_CONTROLS_CLASS = 'hami-custom-pip-controls';
  const VIDEO_PIP_FALLBACK_CLASS = 'hami-video-pip-fallback-active';
  const CUSTOM_CONTROLS_SAFE_AREA_PROPERTY = '--hami-custom-pip-controls-safe-area';
  const CUSTOM_CONTROLS_SAFE_AREA_MIN = 76;
  const CUSTOM_CONTROLS_SAFE_AREA_RATIO = 0.22;
  const CUSTOM_CONTROLS_SAFE_AREA_MAX = 128;
  // playing／paused 共用 2 秒閒置門檻；只有 PiP 內的實際使用者互動會重新開始倒數。
  const CONTROLS_IDLE_DELAY_MS = 2000;
  const DASH_TTML_REGION_SELECTOR = '#dash-ttml-caption > [id^="cue_TTML_"] > div > div';
  const LOG_PREFIX = '[Custom Document PiP Controller]';

  const controllerScriptElement = document.currentScript || document.getElementById('custPIPControllerScript');
  const controllerScriptUrl = controllerScriptElement && controllerScriptElement.src
    ? controllerScriptElement.src
    : document.baseURI;
  const customStyleUrlObject = new URL('./custPIPControllerStyle.css', controllerScriptUrl);
  // 新增正式 CSS 時使用任務版本避免瀏覽器沿用實驗期間同名快取；後續若修改 CSS，需同步遞增此版本。
  customStyleUrlObject.searchParams.set('v', '20260813_01');
  const customStyleUrl = customStyleUrlObject.href;

  let activeDocumentPipSession = null;
  let documentPipRequestPending = false;

  if (window.hamiCustomPipController && window.hamiCustomPipController.initialized) {
    return;
  }

  const video = document.querySelector(VIDEO_SELECTOR);
  if (!video) {
    console.warn(`${LOG_PREFIX} 找不到 video，略過自訂 Document PiP 控制器初始化。`);
    return;
  }

  installVideoPipFallbackStyle();
  bindVideoPipFallbackEvents(video);
  document.addEventListener('click', handlePipButtonClick, true);

  // 某些交付 Plyr bundle 未建立 PiP 按鈕；觀察 controls 重建並補上相同 data-plyr 語意，且不重複插入。
  const pipButtonObserver = new MutationObserver(function handlePlayerControlsMutation() {
    ensurePipButton();
  });
  pipButtonObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  // 同頁切換 hardware video／software canvas 時 script.js 會改 video.style.display；直接觀察該屬性以同步移除或補回按鈕。
  pipButtonObserver.observe(video, {
    attributes: true,
    attributeFilter: ['style']
  });
  ensurePipButton();

  /**
   * Document PiP 僅能在安全來源的頂層文件使用，requestWindow() 仍可能因瀏覽器政策被拒絕。
   */
  function canUseDocumentPip() {
    return window.isSecureContext === true &&
      window.top === window &&
      'documentPictureInPicture' in window &&
      window.documentPictureInPicture &&
      typeof window.documentPictureInPicture.requestWindow === 'function';
  }

  // 只有 controls 缺少 PiP 時才補按鈕；標記自建按鈕，讓不支援 Document PiP 的瀏覽器可由本控制器執行 Video PiP fallback。
  function ensurePipButton() {
    const controls = document.querySelector('.plyr__controls');
    if (!controls) {
      return;
    }

    const playerElement = controls.closest(PLAYER_SELECTOR);
    const playerVideo = playerElement ? playerElement.querySelector(VIDEO_SELECTOR) : null;
    const existingPipButton = controls.querySelector(PIP_BUTTON_SELECTOR);

    // Controller 載入後若同頁切到 software canvas，移除本控制器補出的按鈕；既有 Plyr 按鈕則不碰。
    if (!playerVideo || playerVideo !== video || playerVideo.style.display === 'none') {
      if (existingPipButton && existingPipButton.getAttribute('data-hami-custom-pip-button') === 'true') {
        existingPipButton.remove();
      }
      return;
    }

    if (existingPipButton) {
      return;
    }

    const standardVideoPipSupported = Boolean(document.pictureInPictureEnabled &&
      playerVideo &&
      typeof playerVideo.requestPictureInPicture === 'function');
    const safariVideoPipSupported = Boolean(playerVideo &&
      typeof playerVideo.webkitSetPresentationMode === 'function');

    if (!canUseDocumentPip() && !standardVideoPipSupported && !safariVideoPipSupported) {
      return;
    }

    const pipButton = createPipButton();
    const fullscreenButton = controls.querySelector('[data-plyr="fullscreen"]');
    controls.insertBefore(pipButton, fullscreenButton || null);

    if (playerElement) {
      playerElement.classList.add('plyr--pip-supported');
    }

    // console.info(`${LOG_PREFIX} Plyr controls 未提供 PiP，已補上按鈕。`);
  }

  function createPipButton() {
    const pipButton = document.createElement('button');
    pipButton.type = 'button';
    pipButton.className = 'plyr__controls__item plyr__control';
    pipButton.setAttribute('data-plyr', 'pip');
    pipButton.setAttribute('data-hami-custom-pip-button', 'true');
    pipButton.setAttribute('aria-label', 'Picture in Picture');

    const iconElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconElement.setAttribute('aria-hidden', 'true');
    iconElement.setAttribute('focusable', 'false');

    const useElement = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    const iconUrl = window.player && window.player.config && window.player.config.iconUrl
      ? window.player.config.iconUrl
      : '../icon/plyr.svg';
    const iconPath = `${iconUrl}#icon-plyr-pip`;
    useElement.setAttribute('href', iconPath);
    useElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', iconPath);
    iconElement.appendChild(useElement);

    const labelElement = document.createElement('span');
    labelElement.className = 'plyr__sr-only';
    labelElement.textContent = 'Picture in Picture';

    pipButton.appendChild(iconElement);
    pipButton.appendChild(labelElement);
    return pipButton;
  }

  /**
   * Capture phase 先於 Plyr 判斷 Document PiP。既有 Plyr 按鈕在不支援時維持原行為；
   * 只有本控制器補出的按鈕，才由此處明確執行標準 Video PiP／Safari fallback。
   */
  function handlePipButtonClick(event) {
    const eventTarget = event.target;
    const pipButton = eventTarget && typeof eventTarget.closest === 'function'
      ? eventTarget.closest(PIP_BUTTON_SELECTOR)
      : null;

    if (!pipButton) {
      return;
    }

    const playerElement = pipButton.closest(PLAYER_SELECTOR);
    const playerVideo = playerElement ? playerElement.querySelector(VIDEO_SELECTOR) : null;

    // 軟體解碼使用 canvas，不在本次硬體解碼 PiP 控制器範圍內。
    if (!playerElement || !playerVideo || playerVideo !== video || playerVideo.style.display === 'none') {
      return;
    }

    if (!canUseDocumentPip()) {
      if (pipButton.getAttribute('data-hami-custom-pip-button') !== 'true') {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      toggleVideoPipFallback(playerVideo);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (activeDocumentPipSession) {
      activeDocumentPipSession.pipWindow.close();
      return;
    }

    if (!documentPipRequestPending) {
      openDocumentPip(playerElement, playerVideo);
    }
  }

  // requestWindow() 保持在使用者操作 call stack；CSS 載入成功後才搬 DOM，失敗時原頁不會留下半套播放器。
  async function openDocumentPip(playerElement, playerVideo) {
    documentPipRequestPending = true;
    let pipWindow = null;
    let pipWindowClosed = false;
    let resolvePipWindowClosed = null;
    let session = null;

    try {
      const playerBounds = playerElement.getBoundingClientRect();
      const requestedWidth = Math.max(320, Math.round(playerBounds.width));
      const requestedHeight = Math.max(180, Math.round(playerBounds.height));
      pipWindow = await window.documentPictureInPicture.requestWindow({
        width: requestedWidth,
        height: requestedHeight
      });

      // 在任何 await 前監聽關閉，避免 CSS 或 Fullscreen 流程完成後把 DOM 搬入已關閉的 PiP 文件。
      const pipWindowClosedPromise = new Promise(function waitForEarlyPipClose(resolve) {
        resolvePipWindowClosed = resolve;
      });
      pipWindow.addEventListener('pagehide', function handleDocumentPipPageHide() {
        pipWindowClosed = true;
        if (resolvePipWindowClosed) {
          resolvePipWindowClosed(false);
          resolvePipWindowClosed = null;
        }
        if (session) {
          restorePlayerFromDocumentPip(session);
        }
      }, { once: true });

      copyDocumentStyles(document, pipWindow.document);
      // CSS 尚未回報 load/error 前若使用者已關窗，以 close promise 結束等待；這是正常取消，不再嘗試 Video PiP fallback。
      const customStyleReady = await Promise.race([
        loadCustomPipStyle(pipWindow.document).then(function markCustomStyleReady() {
          return true;
        }),
        pipWindowClosedPromise
      ]);
      if (!customStyleReady || pipWindowClosed || pipWindow.closed) {
        return;
      }
      resolvePipWindowClosed = null;

      if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        try {
          await document.exitFullscreen();
        } catch (fullscreenError) {
          console.warn(`${LOG_PREFIX} 原頁 Fullscreen 結束失敗，仍繼續建立 Document PiP。`, fullscreenError);
        }
      }

      if (pipWindowClosed || pipWindow.closed) {
        return;
      }

      const visualElements = collectPipVisualElements(playerElement);
      if (!visualElements.length) {
        pipWindow.close();
        throw new Error('找不到可搬入 PiP 的 video wrapper。');
      }

      preparePipDocument(pipWindow.document);
      const pipPlayerHost = createPipPlayerHost(pipWindow.document, playerElement);
      const stateObserver = new MutationObserver(function mirrorPlayerStateToPip() {
        syncPipPlayerHostState(playerElement, pipPlayerHost);
      });
      stateObserver.observe(playerElement, {
        attributes: true,
        attributeFilter: ['class', 'style']
      });

      session = {
        pipWindow,
        playerElement,
        playerVideo,
        pipPlayerHost,
        stateObserver,
        customControlsController: null,
        captionSafeAreaController: null,
        pipWindowResizeHandler: null,
        movedElements: [],
        nativeControlsEnabled: playerVideo.controls,
        disablePictureInPicture: playerVideo.disablePictureInPicture
      };

      activeDocumentPipSession = session;
      playerElement.setAttribute('data-hami-document-pip-source', 'true');
      pipWindow.document.body.appendChild(pipPlayerHost);

      visualElements.forEach(function moveVisualElement(element) {
        session.movedElements.push(moveElementToPip(element, pipPlayerHost));
      });

      // 自訂控制列與瀏覽器原生 controls 必須互斥，離開 PiP 時再精確還原原值。
      playerVideo.controls = false;
      if ('disablePictureInPicture' in playerVideo) {
        playerVideo.disablePictureInPicture = true;
      }

      session.customControlsController = installCustomPipControls(session);
      session.captionSafeAreaController = installDocumentPipCaptionSafeArea(session);
      session.pipWindowResizeHandler = function handleDocumentPipResize() {
        notifyPlayerResize(pipWindow, playerVideo);
        session.customControlsController.refreshMediaMode();
        session.captionSafeAreaController.schedule();
      };
      pipWindow.addEventListener('resize', session.pipWindowResizeHandler);

      notifyPlayerResize(pipWindow, playerVideo);
    } catch (error) {
      if (session && activeDocumentPipSession === session) {
        restorePlayerFromDocumentPip(session);
      }
      if (pipWindow && !pipWindow.closed) {
        pipWindow.close();
      }
      console.error(`${LOG_PREFIX} Document PiP 開啟失敗，播放器已保持或還原至原頁。`, error);
      await tryOpenVideoPipFallback(playerVideo);
    } finally {
      documentPipRequestPending = false;
    }
  }

  // 關閉時先銷毀 PiP timer／listener，再依 placeholder 搬回同一批節點，不重建串流播放器或改寫字幕選軌。
  function restorePlayerFromDocumentPip(session) {
    if (activeDocumentPipSession !== session) {
      return;
    }

    if (session.customControlsController) {
      session.customControlsController.destroy();
      session.customControlsController = null;
    }
    if (session.captionSafeAreaController) {
      session.captionSafeAreaController.destroy();
      session.captionSafeAreaController = null;
    }
    if (session.pipWindowResizeHandler) {
      session.pipWindow.removeEventListener('resize', session.pipWindowResizeHandler);
      session.pipWindowResizeHandler = null;
    }
    session.stateObserver.disconnect();

    session.playerVideo.controls = session.nativeControlsEnabled;
    if ('disablePictureInPicture' in session.playerVideo) {
      session.playerVideo.disablePictureInPicture = session.disablePictureInPicture;
    }

    session.movedElements.forEach(function restoreVisualElement(movedElement) {
      if (movedElement.placeholder.parentNode) {
        movedElement.placeholder.parentNode.replaceChild(movedElement.element, movedElement.placeholder);
      }
    });

    session.playerElement.removeAttribute('data-hami-document-pip-source');
    session.pipPlayerHost.remove();
    activeDocumentPipSession = null;
    notifyPlayerResize(window, session.playerVideo);
  }

  function collectPipVisualElements(playerElement) {
    const videoWrapper = playerElement.querySelector('.plyr__video-wrapper');
    const plyrCaptions = playerElement.querySelector('.plyr__captions');
    const dashTtmlCaptions = playerElement.querySelector('#dash-ttml-caption');

    return [videoWrapper, plyrCaptions, dashTtmlCaptions].filter(function keepExistingElement(element) {
      return Boolean(element);
    });
  }

  function createPipPlayerHost(pipDocument, playerElement) {
    const pipPlayerHost = pipDocument.createElement('div');
    syncPipPlayerHostState(playerElement, pipPlayerHost);
    pipPlayerHost.classList.add(CUSTOM_PIP_HOST_CLASS);
    pipPlayerHost.setAttribute('data-hami-custom-document-pip', 'true');
    pipPlayerHost.setAttribute('data-hami-ui-hidden', 'false');
    return pipPlayerHost;
  }

  /**
   * Plyr 會以 container class 控制 captions 顯示；同步原頁 class/style，但 UI 狀態保留在 data attribute，避免被覆寫。
   */
  function syncPipPlayerHostState(playerElement, pipPlayerHost) {
    pipPlayerHost.className = playerElement.className;
    pipPlayerHost.classList.add(CUSTOM_PIP_HOST_CLASS);
    pipPlayerHost.style.cssText = playerElement.style.cssText;
  }

  function moveElementToPip(element, pipPlayerHost) {
    if (!element.parentNode) {
      throw new Error(`節點 ${element.className || element.id} 已離開原始 DOM。`);
    }

    const placeholder = document.createComment(`hami-custom-document-pip-${element.className || element.id}`);
    element.parentNode.replaceChild(placeholder, element);
    pipPlayerHost.appendChild(element);

    return {
      element,
      placeholder
    };
  }

  // 複製原頁 CSS 以保留 Plyr captions／TTML 外觀；跨來源規則無法讀取時改以原 href 載入。
  function copyDocumentStyles(sourceDocument, targetDocument) {
    const baseElement = targetDocument.createElement('base');
    baseElement.href = sourceDocument.baseURI;
    targetDocument.head.appendChild(baseElement);

    Array.from(sourceDocument.styleSheets).forEach(function copyStyleSheet(styleSheet) {
      try {
        const cssText = Array.from(styleSheet.cssRules)
          .map(function getCssText(rule) {
            return rule.cssText;
          })
          .join('\n');
        const styleElement = targetDocument.createElement('style');
        styleElement.textContent = cssText;
        targetDocument.head.appendChild(styleElement);
      } catch (styleSheetError) {
        if (styleSheet.href) {
          const linkElement = targetDocument.createElement('link');
          linkElement.rel = 'stylesheet';
          linkElement.href = styleSheet.href;
          targetDocument.head.appendChild(linkElement);
        } else {
          console.warn(`${LOG_PREFIX} 無法複製無 href 的樣式表。`, styleSheetError);
        }
      }
    });
  }

  function loadCustomPipStyle(pipDocument) {
    return new Promise(function waitForCustomPipStyle(resolve, reject) {
      const linkElement = pipDocument.createElement('link');
      linkElement.rel = 'stylesheet';
      linkElement.href = customStyleUrl;
      linkElement.setAttribute('data-hami-custom-pip-style', 'true');
      linkElement.addEventListener('load', resolve, { once: true });
      linkElement.addEventListener('error', function handleCustomPipStyleError() {
        reject(new Error(`自訂 PiP CSS 載入失敗：${customStyleUrl}`));
      }, { once: true });
      pipDocument.head.appendChild(linkElement);
    });
  }

  function preparePipDocument(pipDocument) {
    pipDocument.title = document.title;
    pipDocument.documentElement.lang = document.documentElement.lang || 'zh-Hant';
  }

  // 自訂 controls 僅操作同一個 video；VOD 可 seek，LIVE／DVR 一律顯示 LIVE 並停用 timeline。
  function installCustomPipControls(session) {
    const pipWindow = session.pipWindow;
    const pipDocument = pipWindow.document;
    const pipPlayerHost = session.pipPlayerHost;
    const playerVideo = session.playerVideo;
    const controlsElement = pipDocument.createElement('div');
    controlsElement.className = CUSTOM_PIP_CONTROLS_CLASS;
    controlsElement.setAttribute('data-hami-custom-pip-controls', 'true');

    const playbackButton = pipDocument.createElement('button');
    playbackButton.type = 'button';
    playbackButton.className = 'hami-custom-pip-playback-button';
    playbackButton.innerHTML = '<span class="hami-custom-pip-play-icon" aria-hidden="true"></span>' +
      '<span class="hami-custom-pip-pause-icon" aria-hidden="true"></span>';

    const bottomControls = pipDocument.createElement('div');
    bottomControls.className = 'hami-custom-pip-bottom-controls';

    const timeline = pipDocument.createElement('input');
    timeline.type = 'range';
    timeline.className = 'hami-custom-pip-timeline';
    timeline.min = '0';
    timeline.max = '1000';
    timeline.step = '1';
    timeline.value = '0';
    timeline.setAttribute('aria-label', '播放進度');

    const currentTimeElement = pipDocument.createElement('span');
    currentTimeElement.className = 'hami-custom-pip-current-time';
    currentTimeElement.setAttribute('aria-live', 'off');

    bottomControls.appendChild(timeline);
    bottomControls.appendChild(currentTimeElement);
    controlsElement.appendChild(playbackButton);
    controlsElement.appendChild(bottomControls);
    pipPlayerHost.appendChild(controlsElement);

    let destroyed = false;
    let timelineDragging = false;
    let confirmedVod = false;
    let pointerInsideHost = false;
    let hideTimerId = 0;
    const eventBindings = [];

    function bind(target, eventName, handler, options) {
      target.addEventListener(eventName, handler, options);
      eventBindings.push({ target, eventName, handler, options });
    }

    // 所有隱藏路徑都先清除舊 timer，避免 pointerleave 後仍殘留逾時計時工作。
    function clearControlsHideTimer() {
      if (!hideTimerId) {
        return;
      }
      pipWindow.clearTimeout(hideTimerId);
      hideTimerId = 0;
    }

    function hideControls() {
      clearControlsHideTimer();
      if (destroyed) {
        return;
      }
      pipPlayerHost.setAttribute('data-hami-ui-hidden', 'true');
    }

    function showControls() {
      if (destroyed) {
        return;
      }
      pipPlayerHost.setAttribute('data-hami-ui-hidden', 'false');
    }

    // 滑鼠停在 PiP 內超過 2 秒即隱藏；移動、點擊或鍵盤操作才重新開始倒數。
    function scheduleControlsHide() {
      clearControlsHideTimer();
      if (destroyed || timelineDragging) {
        return;
      }
      hideTimerId = pipWindow.setTimeout(function handleControlsIdle() {
        hideTimerId = 0;
        hideControls();
      }, CONTROLS_IDLE_DELAY_MS);
    }

    function showControlsTemporarily() {
      showControls();
      scheduleControlsHide();
    }

    function handlePointerActivity() {
      pointerInsideHost = true;
      showControlsTemporarily();
    }

    function handlePointerLeave() {
      pointerInsideHost = false;
      hideControls();
    }

    function showControlsWhenPointerInside() {
      if (pointerInsideHost) {
        showControlsTemporarily();
      }
    }

    function updatePlaybackButton() {
      const playing = !playerVideo.paused && !playerVideo.ended;
      playbackButton.setAttribute('data-hami-playing', String(playing));
      playbackButton.setAttribute('aria-label', playing ? '暫停' : '播放');
    }

    function isConfirmedVod() {
      const player = window.player;
      return Boolean(
        player &&
        player.media === playerVideo &&
        player.config &&
        player.config.live === false &&
        Number.isFinite(playerVideo.duration) &&
        playerVideo.duration > 0
      );
    }

    function formatTime(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) {
        return '0:00';
      }

      const roundedSeconds = Math.floor(seconds);
      const hours = Math.floor(roundedSeconds / 3600);
      const minutes = Math.floor((roundedSeconds % 3600) / 60);
      const remainingSeconds = roundedSeconds % 60;
      const minuteText = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
      const secondText = String(remainingSeconds).padStart(2, '0');
      return hours > 0
        ? `${hours}:${minuteText}:${secondText}`
        : `${minuteText}:${secondText}`;
    }

    function updateTimeline() {
      if (!confirmedVod) {
        timeline.value = '0';
        timeline.style.setProperty('--hami-custom-pip-progress', '0%');
        currentTimeElement.textContent = 'LIVE';
        return;
      }

      const duration = playerVideo.duration;
      const currentTime = Math.min(Math.max(playerVideo.currentTime || 0, 0), duration);
      const timelineValue = Math.round((currentTime / duration) * 1000);
      if (!timelineDragging) {
        timeline.value = String(timelineValue);
      }
      timeline.style.setProperty('--hami-custom-pip-progress', `${timelineValue / 10}%`);
      currentTimeElement.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }

    function refreshMediaMode() {
      confirmedVod = isConfirmedVod();
      timeline.disabled = !confirmedVod;
      timeline.setAttribute('aria-disabled', String(!confirmedVod));
      pipPlayerHost.setAttribute('data-hami-live', String(!confirmedVod));
      updateTimeline();
    }

    function togglePlayback() {
      if (!playerVideo.paused && !playerVideo.ended) {
        playerVideo.pause();
        return;
      }

      try {
        const playPromise = playerVideo.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function handleCustomPipPlayRejection(error) {
            console.warn(`${LOG_PREFIX} 自訂 PiP 無法開始播放。`, error);
          });
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} 自訂 PiP 無法開始播放。`, error);
      }
    }

    function handlePlaybackButtonClick(event) {
      event.preventDefault();
      event.stopPropagation();
      togglePlayback();
      showControlsTemporarily();
    }

    function handlePlaybackSurfaceClick(event) {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      const eventTarget = event.target;
      if (eventTarget && typeof eventTarget.closest === 'function' &&
          eventTarget.closest(`.${CUSTOM_PIP_CONTROLS_CLASS}`)) {
        return;
      }

      event.preventDefault();
      if (event.detail <= 1) {
        togglePlayback();
      }
      showControlsTemporarily();
    }

    function handleTimelineInput() {
      if (!confirmedVod) {
        return;
      }

      const requestedTime = (Number(timeline.value) / 1000) * playerVideo.duration;
      if (Number.isFinite(requestedTime)) {
        playerVideo.currentTime = requestedTime;
      }
      updateTimeline();
      showControlsTemporarily();
    }

    function handleTimelinePointerDown() {
      timelineDragging = true;
      clearControlsHideTimer();
      showControls();
    }

    function handleTimelinePointerEnd() {
      if (!timelineDragging) {
        return;
      }
      timelineDragging = false;
      updateTimeline();
      if (pointerInsideHost) {
        showControlsTemporarily();
      } else {
        hideControls();
      }
    }

    function handleControlsFocusActivity() {
      // 鍵盤 focus 視為使用者互動並重新倒數；滑鼠移出影片內容區仍由 pointerleave 立即隱藏。
      showControlsTemporarily();
    }

    function handleBottomControlsClick(event) {
      // 整段底部控制區都阻擋 surface click；LIVE disabled range 的空白區不可誤觸發播放切換。
      event.stopPropagation();
      showControlsTemporarily();
    }

    function handlePlaybackStateChange() {
      updatePlaybackButton();
    }

    bind(pipPlayerHost, 'pointerenter', handlePointerActivity);
    bind(pipPlayerHost, 'pointermove', handlePointerActivity);
    bind(pipPlayerHost, 'pointerleave', handlePointerLeave);
    bind(pipPlayerHost, 'click', handlePlaybackSurfaceClick);
    bind(playbackButton, 'click', handlePlaybackButtonClick);
    bind(bottomControls, 'click', handleBottomControlsClick);
    bind(timeline, 'input', handleTimelineInput);
    bind(timeline, 'change', handleTimelinePointerEnd);
    bind(timeline, 'pointerdown', handleTimelinePointerDown);
    bind(pipWindow, 'pointerup', handleTimelinePointerEnd);
    bind(pipWindow, 'pointercancel', handleTimelinePointerEnd);
    // 拖曳途中切到其他視窗時解除鎖定；若滑鼠已離開影片內容區，維持 UI 隱藏狀態。
    bind(pipWindow, 'blur', handleTimelinePointerEnd);
    bind(controlsElement, 'focusin', handleControlsFocusActivity);
    bind(playerVideo, 'play', handlePlaybackStateChange);
    bind(playerVideo, 'pause', handlePlaybackStateChange);
    bind(playerVideo, 'ended', handlePlaybackStateChange);
    bind(playerVideo, 'timeupdate', updateTimeline);
    bind(playerVideo, 'seeking', showControlsWhenPointerInside);
    bind(playerVideo, 'seeked', showControlsWhenPointerInside);
    bind(playerVideo, 'loadedmetadata', refreshMediaMode);
    bind(playerVideo, 'durationchange', refreshMediaMode);
    bind(playerVideo, 'emptied', refreshMediaMode);

    updatePlaybackButton();
    refreshMediaMode();
    showControls();
    scheduleControlsHide();

    return {
      refreshMediaMode,
      destroy() {
        if (destroyed) {
          return;
        }
        clearControlsHideTimer();
        destroyed = true;
        eventBindings.forEach(function removeBinding(binding) {
          binding.target.removeEventListener(binding.eventName, binding.handler, binding.options);
        });
        eventBindings.length = 0;
        controlsElement.remove();
      }
    };
  }

  // DASH TTML 保留 dash.js 原始畫布；只上移碰到固定 controls 安全區的實際文字／圖片，UI 顯隱時不改位置以避免跳動。
  function installDocumentPipCaptionSafeArea(session) {
    const pipWindow = session.pipWindow;
    const pipPlayerHost = session.pipPlayerHost;
    const dashCaptionContainer = pipPlayerHost.querySelector('#dash-ttml-caption');
    const originalRegionTranslations = new Map();
    let firstAnimationFrameId = 0;
    let secondAnimationFrameId = 0;
    let destroyed = false;

    const dashCaptionObserver = dashCaptionContainer
      ? new pipWindow.MutationObserver(function handleDashCaptionMutation() {
        applyCaptionSafeArea();
      })
      : null;
    const dashCaptionResizeObserver = dashCaptionContainer && typeof pipWindow.ResizeObserver === 'function'
      ? new pipWindow.ResizeObserver(function handleDashCaptionResize() {
        schedule();
      })
      : null;

    if (dashCaptionObserver) {
      dashCaptionObserver.observe(dashCaptionContainer, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }
    if (dashCaptionResizeObserver) {
      dashCaptionResizeObserver.observe(dashCaptionContainer);
    }

    function schedule() {
      if (destroyed || firstAnimationFrameId || secondAnimationFrameId) {
        return;
      }

      firstAnimationFrameId = pipWindow.requestAnimationFrame(function waitForDashLayout() {
        firstAnimationFrameId = 0;
        secondAnimationFrameId = pipWindow.requestAnimationFrame(function applyStableCaptionLayout() {
          secondAnimationFrameId = 0;
          applyCaptionSafeArea();
        });
      });
    }

    function applyCaptionSafeArea() {
      if (destroyed) {
        return;
      }

      const safeArea = getCustomPipControlsSafeArea(pipWindow);
      pipPlayerHost.style.setProperty(CUSTOM_CONTROLS_SAFE_AREA_PROPERTY, `${safeArea}px`);

      if (!dashCaptionContainer) {
        return;
      }

      const dashRegions = Array.from(dashCaptionContainer.querySelectorAll(DASH_TTML_REGION_SELECTOR));
      restoreRemovedDashRegionTranslations(dashRegions, originalRegionTranslations);
      dashRegions.forEach(function restoreRegionBeforeMeasurement(regionElement) {
        rememberAndRestoreDashRegionTranslation(regionElement, originalRegionTranslations);
      });

      const captionContainerBounds = dashCaptionContainer.getBoundingClientRect();
      if (captionContainerBounds.width <= 0 || captionContainerBounds.height <= 0) {
        return;
      }

      const controlsBoundary = Math.max(0, pipWindow.innerHeight - safeArea);
      const containerTop = Math.max(0, captionContainerBounds.top);

      dashRegions.forEach(function moveOverlappingDashRegion(regionElement) {
        const paintedBounds = getDashRegionPaintedBounds(regionElement, captionContainerBounds);
        if (!paintedBounds || paintedBounds.bottom <= controlsBoundary) {
          return;
        }

        const overlap = Math.ceil(paintedBounds.bottom - controlsBoundary);
        const availableSpaceAbove = Math.max(0, Math.floor(paintedBounds.top - containerTop));
        const upwardShift = Math.min(overlap, availableSpaceAbove);
        if (upwardShift > 0) {
          regionElement.style.setProperty('translate', `0 -${upwardShift}px`, 'important');
        }
      });
    }

    function destroy() {
      destroyed = true;
      if (dashCaptionObserver) {
        dashCaptionObserver.disconnect();
      }
      if (dashCaptionResizeObserver) {
        dashCaptionResizeObserver.disconnect();
      }
      if (firstAnimationFrameId) {
        pipWindow.cancelAnimationFrame(firstAnimationFrameId);
      }
      if (secondAnimationFrameId) {
        pipWindow.cancelAnimationFrame(secondAnimationFrameId);
      }

      originalRegionTranslations.forEach(function restoreRegionTranslation(originalTranslation, regionElement) {
        restoreDashRegionTranslation(regionElement, originalTranslation);
      });
      originalRegionTranslations.clear();
      pipPlayerHost.style.removeProperty(CUSTOM_CONTROLS_SAFE_AREA_PROPERTY);
    }

    applyCaptionSafeArea();
    schedule();
    return { schedule, destroy };
  }

  function getCustomPipControlsSafeArea(pipWindow) {
    return Math.min(
      CUSTOM_CONTROLS_SAFE_AREA_MAX,
      Math.max(
        CUSTOM_CONTROLS_SAFE_AREA_MIN,
        Math.round(pipWindow.innerHeight * CUSTOM_CONTROLS_SAFE_AREA_RATIO)
      )
    );
  }

  function getDashRegionPaintedBounds(regionElement, captionContainerBounds) {
    const paintedElements = Array.from(regionElement.querySelectorAll('p, img'));
    let paintedBounds = null;

    paintedElements.forEach(function includeVisiblePaintedElement(paintedElement) {
      const elementBounds = paintedElement.getBoundingClientRect();
      const intersectsCaptionContainer = elementBounds.width > 0 &&
        elementBounds.height > 0 &&
        elementBounds.right > captionContainerBounds.left &&
        elementBounds.left < captionContainerBounds.right &&
        elementBounds.bottom > captionContainerBounds.top &&
        elementBounds.top < captionContainerBounds.bottom;

      if (!intersectsCaptionContainer) {
        return;
      }

      if (!paintedBounds) {
        paintedBounds = {
          top: elementBounds.top,
          bottom: elementBounds.bottom
        };
        return;
      }

      paintedBounds.top = Math.min(paintedBounds.top, elementBounds.top);
      paintedBounds.bottom = Math.max(paintedBounds.bottom, elementBounds.bottom);
    });

    return paintedBounds;
  }

  function rememberAndRestoreDashRegionTranslation(regionElement, originalRegionTranslations) {
    if (!originalRegionTranslations.has(regionElement)) {
      originalRegionTranslations.set(regionElement, {
        value: regionElement.style.getPropertyValue('translate'),
        priority: regionElement.style.getPropertyPriority('translate')
      });
    }

    restoreDashRegionTranslation(regionElement, originalRegionTranslations.get(regionElement));
  }

  function restoreRemovedDashRegionTranslations(currentRegions, originalRegionTranslations) {
    originalRegionTranslations.forEach(function restoreRemovedRegion(originalTranslation, regionElement) {
      if (currentRegions.indexOf(regionElement) !== -1) {
        return;
      }

      restoreDashRegionTranslation(regionElement, originalTranslation);
      originalRegionTranslations.delete(regionElement);
    });
  }

  function restoreDashRegionTranslation(regionElement, originalTranslation) {
    if (originalTranslation.value) {
      regionElement.style.setProperty('translate', originalTranslation.value, originalTranslation.priority);
    } else {
      regionElement.style.removeProperty('translate');
    }
  }

  function notifyPlayerResize(targetWindow, playerVideo) {
    targetWindow.requestAnimationFrame(function dispatchResizeEvents() {
      window.dispatchEvent(new Event('resize'));
      playerVideo.dispatchEvent(new Event('resize'));
    });
  }

  // Document PiP 不可用或建立失敗時保留標準 Video PiP；fallback 只能清除母畫面殘影，無法帶入網站字幕 DOM。
  function installVideoPipFallbackStyle() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .plyr[data-hami-document-pip-source="true"] {
        visibility: hidden !important;
      }

      html.${VIDEO_PIP_FALLBACK_CLASS} .plyr__captions,
      html.${VIDEO_PIP_FALLBACK_CLASS} #dash-ttml-caption {
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(styleElement);
  }

  function bindVideoPipFallbackEvents(playerVideo) {
    playerVideo.addEventListener('enterpictureinpicture', activateVideoPipFallback);
    playerVideo.addEventListener('leavepictureinpicture', deactivateVideoPipFallback);
    playerVideo.addEventListener('webkitpresentationmodechanged', function handleWebkitPresentationModeChanged() {
      if (playerVideo.webkitPresentationMode === 'picture-in-picture') {
        activateVideoPipFallback();
      } else {
        deactivateVideoPipFallback();
      }
    });
  }

  function activateVideoPipFallback() {
    document.documentElement.classList.add(VIDEO_PIP_FALLBACK_CLASS);

    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(function handleExitFullscreenError(error) {
        console.warn(`${LOG_PREFIX} Video PiP fallback 無法結束 Fullscreen。`, error);
      });
    }

    console.warn(`${LOG_PREFIX} 此環境改走標準 Video PiP；原頁字幕已隱藏，但 PiP 內不保證有網站字幕。`);
  }

  function deactivateVideoPipFallback() {
    document.documentElement.classList.remove(VIDEO_PIP_FALLBACK_CLASS);
  }

  function toggleVideoPipFallback(playerVideo) {
    if (document.pictureInPictureElement === playerVideo && typeof document.exitPictureInPicture === 'function') {
      document.exitPictureInPicture().catch(function handleExitVideoPipError(error) {
        console.warn(`${LOG_PREFIX} 無法關閉標準 Video PiP。`, error);
      });
      return;
    }

    if (document.pictureInPictureEnabled && typeof playerVideo.requestPictureInPicture === 'function') {
      tryOpenVideoPipFallback(playerVideo);
      return;
    }

    if (typeof playerVideo.webkitSetPresentationMode === 'function') {
      const nextMode = playerVideo.webkitPresentationMode === 'picture-in-picture'
        ? 'inline'
        : 'picture-in-picture';
      playerVideo.webkitSetPresentationMode(nextMode);
    }
  }

  async function tryOpenVideoPipFallback(playerVideo) {
    if (!document.pictureInPictureEnabled ||
        typeof playerVideo.requestPictureInPicture !== 'function' ||
        document.pictureInPictureElement === playerVideo) {
      return false;
    }

    try {
      await playerVideo.requestPictureInPicture();
      return true;
    } catch (fallbackError) {
      console.warn(`${LOG_PREFIX} 標準 Video PiP fallback 也無法開啟。`, fallbackError);
      return false;
    }
  }

  // 提供最小唯讀狀態與 close API，供手動驗證及換片流程日後在重建內容前主動關閉 PiP。
  window.hamiCustomPipController = {
    initialized: true,
    isDocumentPipSupported: canUseDocumentPip,
    isDocumentPipActive: function isDocumentPipActive() {
      return Boolean(activeDocumentPipSession);
    },
    closeDocumentPip: function closeDocumentPip() {
      if (activeDocumentPipSession) {
        activeDocumentPipSession.pipWindow.close();
      }
    }
  };

  console.info(`${LOG_PREFIX} 初始化完成。Document PiP 可用狀態：${canUseDocumentPip()}`);
})();
