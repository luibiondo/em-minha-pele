/**
 * EM MINHA PELE — Revista Digital (Modo Editorial 3D & Spread)
 * 1. Visualizador fiel ao Figma (frame "V1") com páginas duplas (spreads), vinco de lombada e sombra de relevo
 * 2. Animação 3D de virar página por hardware acceleration (CSS 3D / rotateY) com iluminação dinâmica
 * 3. Síntese de som suave de papel folheando (Web Audio API)
 * 4. Interações originais: Gráfico GEMAA/UERJ, Modal Chico César com QR Code, e links do Índice
 */

(function () {
    'use strict';

    const PAGE_W = 595;
    const PAGE_H = 842;
    const root = document.documentElement;
    const revista = document.querySelector('.revista');
    const slots = Array.from(document.querySelectorAll('.slot'));
    const totalPages = slots.length; // 20 páginas (incluindo Contracapa)

    // Placeholder invisível para manter Capa (à direita) e Contracapa (à esquerda) alinhadas ao centro
    let placeholderSlot = document.querySelector('.slot--placeholder');
    if (!placeholderSlot) {
        placeholderSlot = document.createElement('div');
        placeholderSlot.className = 'slot slot--placeholder';
        placeholderSlot.setAttribute('aria-hidden', 'true');
    }

    // Mapeamento dos Spreads (Páginas Duplas)
    // Spread 0: Capa (fechada à direita)
    // Spreads 1–9: Páginas duplas abertas (2-3, 4-5, 6-7, 8-9, etc.)
    // Spread 10: Contracapa (fechada à esquerda)
    const spreads = [
        { left: null, right: 0 },    // Capa (Página 1)
        { left: 1,    right: 2 },    // Págs 2 e 3 (A beleza não pede licença & Autores)
        { left: 3,    right: 4 },    // Págs 4 e 5 (Índice & Editorial)
        { left: 5,    right: 6 },    // Págs 6 e 7 (Direito de Existir & Antes de se Amar)
        { left: 7,    right: 8 },    // Págs 8 e 9 (Beleza Anunciada & O Belo tem História)
        { left: 9,    right: 10 },   // Págs 10 e 11 (Aparência Masculina & Peso Imposto)
        { left: 11,   right: 12 },   // Págs 12 e 13 (Diante da Tela & Insegurança)
        { left: 13,   right: 14 },   // Págs 14 e 15 (Tons de Base & O Padrão é Político)
        { left: 15,   right: 16 },   // Págs 16 e 17 (Memória & Marcha do Orgulho Crespo)
        { left: 17,   right: 18 },   // Págs 18 e 19 (Outras Formas & O Que Precisa Mudar)
        { left: 19,   right: null }  // Contracapa (Página 20)
    ];

    const state = {
        zoomMode: 'auto',       // 'auto' | 'custom'
        customScale: 1,
        viewMode: 'spread',     // 'spread' (Modo Revista) | 'continuous' | 'single'
        currentSpreadIndex: 0,
        currentPage: 0,
        soundEnabled: true,
        isFlipping: false
    };

    /* -------------------------------------------------------------
     * 1. SÍNTESE DO SOM DE FOLHEAR PAPEL (WEB AUDIO API)
     * ----------------------------------------------------------- */
    function playPaperSound() {
        if (!state.soundEnabled) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const duration = 0.22;
            const bufferSize = Math.floor(ctx.sampleRate * duration);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                const p = i / bufferSize;
                const env = Math.sin(p * Math.PI) * Math.exp(-p * 3.0);
                data[i] = (Math.random() * 2 - 1) * env;
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(800, ctx.currentTime);
            filter.Q.setValueAtTime(1.5, ctx.currentTime);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.24, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start();
        } catch (e) {}
    }

    /* -------------------------------------------------------------
     * 2. CÁLCULO DE ESCALA RESPONSIVA
     * ----------------------------------------------------------- */
    function calcAutoScale() {
        const availableW = window.innerWidth;
        const availableH = window.innerHeight;

        if (state.viewMode === 'spread') {
            const targetW = PAGE_W * 2;
            const targetH = PAGE_H;
            const sW = (availableW - 160) / targetW; // espaço para as setas laterais
            const sH = (availableH - 48) / targetH;
            return Math.min(1.05, Math.max(0.3, Math.min(sW, sH)));
        } else if (state.viewMode === 'single') {
            const sW = (availableW - 48) / PAGE_W;
            const sH = (availableH - 120) / PAGE_H;
            return Math.min(1.2, Math.max(0.35, Math.min(sW, sH)));
        } else {
            // Continuous
            if (availableW < 640) {
                return Math.max(0.45, (availableW - 24) / PAGE_W);
            } else if (availableW < 1240) {
                return Math.min(1, Math.max(0.7, (availableW - 64) / PAGE_W));
            }
            return 1;
        }
    }

    function applyScale() {
        const scale = state.zoomMode === 'auto' ? calcAutoScale() : state.customScale;
        root.style.setProperty('--scale', scale.toFixed(3));
        const zoomLabel = document.getElementById('zoom-val');
        if (zoomLabel) {
            zoomLabel.textContent = `${Math.round(scale * 100)}%`;
        }
    }

    window.addEventListener('resize', () => {
        if (state.zoomMode === 'auto') applyScale();
    });

    /* -------------------------------------------------------------
     * 3. EXIBIÇÃO DE SPREADS (PÁGINAS DUPLAS)
     * ----------------------------------------------------------- */
    // Capa/contracapa fechadas ficam centralizadas na tela (o livro desliza ao abrir)
    function setClosedState(spreadIdx) {
        const spread = spreads[spreadIdx];
        const isSpread = state.viewMode === 'spread';
        revista.classList.toggle('is-closed-front', isSpread && spread.left === null);
        revista.classList.toggle('is-closed-back', isSpread && spread.right === null);

        const prevBtn = document.getElementById('btn-prev');
        const nextBtn = document.getElementById('btn-next');
        if (isSpread) {
            if (prevBtn) prevBtn.disabled = spreadIdx === 0;
            if (nextBtn) nextBtn.disabled = spreadIdx === spreads.length - 1;
        } else {
            if (prevBtn) prevBtn.disabled = state.currentPage === 0;
            if (nextBtn) nextBtn.disabled = state.currentPage === totalPages - 1;
        }
    }
    function updateSpreadDisplay(spreadIdx = state.currentSpreadIndex) {
        if (state.viewMode !== 'spread') return;

        const spread = spreads[spreadIdx];
        if (!spread) return;

        // Limpa classes anteriores de todos os slots
        slots.forEach(s => {
            s.style.display = 'none';
            s.classList.remove('is-spread-left', 'is-spread-right', 'is-capa-spread', 'is-contracapa-spread');
        });

        if (placeholderSlot.parentElement) {
            placeholderSlot.remove();
        }

        if (spread.left === null && spread.right !== null) {
            // Capa fechada: à direita da lombada central
            const rightSlot = slots[spread.right];
            if (rightSlot) {
                revista.insertBefore(placeholderSlot, rightSlot);
                placeholderSlot.style.display = 'block';
                rightSlot.style.display = 'block';
                rightSlot.classList.add('is-capa-spread');
            }
        } else if (spread.right === null && spread.left !== null) {
            // Contracapa fechada: à esquerda da lombada central
            const leftSlot = slots[spread.left];
            if (leftSlot) {
                leftSlot.style.display = 'block';
                leftSlot.classList.add('is-contracapa-spread');
                revista.appendChild(placeholderSlot);
                placeholderSlot.style.display = 'block';
            }
        } else {
            // Páginas duplas abertas lado a lado (ex: 2 e 3, 8 e 9)
            const leftSlot = slots[spread.left];
            const rightSlot = slots[spread.right];
            if (leftSlot) {
                leftSlot.style.display = 'block';
                leftSlot.classList.add('is-spread-left');
            }
            if (rightSlot) {
                rightSlot.style.display = 'block';
                rightSlot.classList.add('is-spread-right');
            }
        }

        setClosedState(spreadIdx);
        updatePageCounter();
    }

    /* -------------------------------------------------------------
     * 4. ANIMAÇÃO 3D DE VIRADA DE PÁGINA (PAGE FLIPPER)
     * ----------------------------------------------------------- */
    function flipToSpread(targetSpreadIdx, direction = 'next') {
        if (state.isFlipping) return;
        if (targetSpreadIdx < 0 || targetSpreadIdx >= spreads.length) return;
        if (targetSpreadIdx === state.currentSpreadIndex) return;

        // No modo contínuo ou simples, pula a animação 3D
        if (state.viewMode !== 'spread') {
            state.currentSpreadIndex = targetSpreadIdx;
            const spread = spreads[targetSpreadIdx];
            state.currentPage = spread.left !== null ? spread.left : spread.right;
            updatePageVisibility();
            updatePageCounter();
            return;
        }

        state.isFlipping = true;
        playPaperSound();

        const currentSpread = spreads[state.currentSpreadIndex];
        const targetSpread = spreads[targetSpreadIdx];

        // Camada de animação 3D
        const flipperLayer = document.createElement('div');
        flipperLayer.className = 'flipper-layer';

        const flipperSheet = document.createElement('div');
        flipperSheet.className = `flipper-sheet flipper-sheet--${direction}`;

        const frontFace = document.createElement('div');
        frontFace.className = 'flipper-face flipper-face--front';
        const frontLight = document.createElement('div');
        frontLight.className = 'flipper-lighting';
        frontFace.appendChild(frontLight);

        const backFace = document.createElement('div');
        backFace.className = 'flipper-face flipper-face--back';
        const backLight = document.createElement('div');
        backLight.className = 'flipper-lighting';
        backFace.appendChild(backLight);

        // Clona as páginas para o movimento 3D
        if (direction === 'next') {
            const frontPage = currentSpread.right !== null ? slots[currentSpread.right]?.querySelector('.page') : null;
            const backPage = targetSpread.left !== null ? slots[targetSpread.left]?.querySelector('.page') : null;

            if (frontPage) frontFace.appendChild(frontPage.cloneNode(true));
            if (backPage) backFace.appendChild(backPage.cloneNode(true));
        } else {
            const frontPage = currentSpread.left !== null ? slots[currentSpread.left]?.querySelector('.page') : null;
            const backPage = targetSpread.right !== null ? slots[targetSpread.right]?.querySelector('.page') : null;

            if (frontPage) frontFace.appendChild(frontPage.cloneNode(true));
            if (backPage) backFace.appendChild(backPage.cloneNode(true));
        }

        flipperSheet.appendChild(frontFace);
        flipperSheet.appendChild(backFace);
        flipperLayer.appendChild(flipperSheet);
        revista.appendChild(flipperLayer);

        // Mantém exatamente 2 itens no flexbox durante o giro
        if (direction === 'next') {
            if (currentSpread.right !== null) {
                slots[currentSpread.right].style.display = 'none';
            }
            if (targetSpread.right !== null) {
                slots[targetSpread.right].style.display = 'block';
                slots[targetSpread.right].classList.add('is-spread-right');
            } else {
                revista.appendChild(placeholderSlot);
                placeholderSlot.style.display = 'block';
            }
        } else {
            if (currentSpread.left !== null) {
                slots[currentSpread.left].style.display = 'none';
            }
            if (targetSpread.left !== null) {
                slots[targetSpread.left].style.display = 'block';
                slots[targetSpread.left].classList.add('is-spread-left');
            } else {
                revista.insertBefore(placeholderSlot, revista.firstChild);
                placeholderSlot.style.display = 'block';
            }
        }

        // Executa a rotação 3D acelerada por hardware
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                flipperSheet.classList.add('is-flipped');
                setClosedState(targetSpreadIdx);
            });
        });

        setTimeout(() => {
            state.currentSpreadIndex = targetSpreadIdx;
            const spread = spreads[targetSpreadIdx];
            state.currentPage = spread.left !== null ? spread.left : spread.right;

            updateSpreadDisplay(state.currentSpreadIndex);
            flipperLayer.remove();
            state.isFlipping = false;
        }, 580);
    }

    /* -------------------------------------------------------------
     * 5. MODOS DE VISUALIZAÇÃO
     * ----------------------------------------------------------- */
    function setViewMode(mode) {
        state.viewMode = mode;
        revista.classList.remove('revista--continuous', 'revista--single', 'revista--spread');
        revista.classList.add(`revista--${mode}`);

        document.querySelectorAll('[data-view-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.viewMode === mode);
        });

        if (mode === 'spread') {
            updateSpreadDisplay();
        } else {
            if (placeholderSlot.parentElement) placeholderSlot.remove();
            slots.forEach(s => s.classList.remove('is-spread-left', 'is-spread-right', 'is-capa-spread', 'is-contracapa-spread'));
            updatePageVisibility();
        }

        applyScale();
        updatePageCounter();
    }

    function goToPage(pageIdx) {
        state.currentPage = Math.max(0, Math.min(totalPages - 1, pageIdx));

        if (state.viewMode === 'spread') {
            const targetSpreadIdx = spreads.findIndex(s => s.left === state.currentPage || s.right === state.currentPage);
            if (targetSpreadIdx !== -1 && targetSpreadIdx !== state.currentSpreadIndex) {
                const dir = targetSpreadIdx > state.currentSpreadIndex ? 'next' : 'prev';
                flipToSpread(targetSpreadIdx, dir);
            }
        } else if (state.viewMode === 'single') {
            updatePageVisibility();
            updatePageCounter();
        } else {
            // Continuous
            const target = slots[state.currentPage];
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            updatePageCounter();
        }
    }

    function updatePageVisibility() {
        if (state.viewMode === 'single') {
            slots.forEach((s, i) => {
                s.style.display = i === state.currentPage ? 'block' : 'none';
            });
        } else if (state.viewMode === 'continuous') {
            slots.forEach(s => (s.style.display = 'block'));
        }
    }

    function updatePageCounter() {
        const curLabel = document.getElementById('cur-page-num');
        if (!curLabel) return;

        if (state.viewMode === 'spread') {
            const spread = spreads[state.currentSpreadIndex];
            if (!spread) return;

            if (spread.left === null && spread.right !== null) {
                curLabel.textContent = `1 / ${totalPages}`;
            } else if (spread.right === null && spread.left !== null) {
                curLabel.textContent = `${totalPages} / ${totalPages}`;
            } else {
                curLabel.textContent = `${spread.left + 1}–${spread.right + 1} / ${totalPages}`;
            }
        } else {
            curLabel.textContent = `${state.currentPage + 1} / ${totalPages}`;
        }
    }

    // Monitora scroll no modo contínuo
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (state.viewMode !== 'continuous') return;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const middleY = window.innerHeight / 2;
            let closestIdx = 0;
            let minDiff = Infinity;
            slots.forEach((s, i) => {
                const rect = s.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                const diff = Math.abs(centerY - middleY);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIdx = i;
                }
            });
            state.currentPage = closestIdx;
            updatePageCounter();
        }, 100);
    });

    /* -------------------------------------------------------------
     * 6. CLIQUE DIRETO NAS PÁGINAS PARA FOLHEAR
     * Clicar no lado direito avança, clicar no lado esquerdo volta
     * ----------------------------------------------------------- */
    revista.addEventListener('click', e => {
        if (state.viewMode !== 'spread' || state.isFlipping) return;

        // Se o clique foi em um botão interativo, link ou hotspot, não vira a página
        if (e.target.closest('button, a, .hotspot, input, select, .box-grafico')) return;

        const slot = e.target.closest('.slot');
        if (!slot) return;

        if (slot.classList.contains('is-spread-right') || slot.classList.contains('is-capa-spread')) {
            flipToSpread(state.currentSpreadIndex + 1, 'next');
        } else if (slot.classList.contains('is-spread-left') || slot.classList.contains('is-contracapa-spread')) {
            flipToSpread(state.currentSpreadIndex - 1, 'prev');
        }
    });

    /* -------------------------------------------------------------
     * 7. TECLADO & NAVEGAÇÃO
     * ----------------------------------------------------------- */
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();

        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            if (state.viewMode === 'spread') {
                flipToSpread(state.currentSpreadIndex + 1, 'next');
            } else {
                goToPage(state.currentPage + 1);
            }
        }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            if (state.viewMode === 'spread') {
                flipToSpread(state.currentSpreadIndex - 1, 'prev');
            } else {
                goToPage(state.currentPage - 1);
            }
        }
    });

    /* -------------------------------------------------------------
     * 8. NAVEGAÇÃO DO ÍNDICE
     * ----------------------------------------------------------- */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', e => {
            const targetId = anchor.getAttribute('href').slice(1);
            const targetEl = document.getElementById(targetId);
            if (!targetEl) return;
            e.preventDefault();

            const targetSlot = targetEl.closest('.slot');
            const targetIdx = slots.indexOf(targetSlot);

            if (targetIdx !== -1) {
                goToPage(targetIdx);
            }

            // Destaque visual temporário
            targetEl.classList.add('page-highlight');
            setTimeout(() => targetEl.classList.remove('page-highlight'), 1200);
        });
    });

    /* -------------------------------------------------------------
     * 9. CONTROLES DA TOOLBAR
     * ----------------------------------------------------------- */
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomFit = document.getElementById('btn-zoom-fit');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnSoundToggle = document.getElementById('btn-sound-toggle');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (state.viewMode === 'spread') {
                flipToSpread(state.currentSpreadIndex - 1, 'prev');
            } else {
                goToPage(state.currentPage - 1);
            }
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            if (state.viewMode === 'spread') {
                flipToSpread(state.currentSpreadIndex + 1, 'next');
            } else {
                goToPage(state.currentPage + 1);
            }
        });
    }

    if (btnZoomIn) {
        btnZoomIn.addEventListener('click', () => {
            const curScale = parseFloat(root.style.getPropertyValue('--scale')) || 1;
            state.zoomMode = 'custom';
            state.customScale = Math.min(1.8, curScale + 0.1);
            applyScale();
        });
    }

    if (btnZoomOut) {
        btnZoomOut.addEventListener('click', () => {
            const curScale = parseFloat(root.style.getPropertyValue('--scale')) || 1;
            state.zoomMode = 'custom';
            state.customScale = Math.max(0.35, curScale - 0.1);
            applyScale();
        });
    }

    if (btnZoomFit) {
        btnZoomFit.addEventListener('click', () => {
            state.zoomMode = 'auto';
            applyScale();
        });
    }

    if (btnSoundToggle) {
        btnSoundToggle.addEventListener('click', () => {
            state.soundEnabled = !state.soundEnabled;
            btnSoundToggle.textContent = state.soundEnabled ? '🔊' : '🔇';
            btnSoundToggle.title = state.soundEnabled ? 'Som de folhear: Ligado' : 'Som de folhear: Mudo';
        });
    }

    document.querySelectorAll('[data-view-mode]').forEach(btn => {
        btn.addEventListener('click', () => setViewMode(btn.dataset.viewMode));
    });

    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        });
    }

    /* -------------------------------------------------------------
     * 10. GRÁFICO GEMAA/UERJ & MODAL CHICO CÉSAR
     * ----------------------------------------------------------- */
    const boxGrafico = document.getElementById('grafico-gemaa');
    const toggleGraficoBtn = document.querySelector('[data-toggle="grafico-gemaa"]');

    function toggleGrafico() {
        if (!boxGrafico) return;
        const isOpen = boxGrafico.classList.toggle('is-open');
        if (toggleGraficoBtn) {
            toggleGraficoBtn.setAttribute('aria-expanded', String(isOpen));
        }
    }

    if (toggleGraficoBtn) toggleGraficoBtn.addEventListener('click', toggleGrafico);
    if (boxGrafico) boxGrafico.addEventListener('click', toggleGrafico);

    const modalMusica = document.getElementById('modal-musica');
    const openMusicaBtn = document.querySelector('[data-open="modal-musica"]');
    const songUrl = 'https://www.youtube.com/watch?v=wX-y0Yh3g1g';
    const qrImg = document.getElementById('qr-musica');
    const linkMusica = document.getElementById('link-musica');

    if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(songUrl)}&color=56-42-19&bgcolor=247-241-232`;
    }
    if (linkMusica) {
        linkMusica.href = songUrl;
    }

    function openModal() {
        if (!modalMusica) return;
        modalMusica.removeAttribute('hidden');
        requestAnimationFrame(() => modalMusica.classList.add('is-open'));
    }

    function closeModal() {
        if (!modalMusica) return;
        modalMusica.classList.remove('is-open');
        setTimeout(() => modalMusica.setAttribute('hidden', ''), 250);
    }

    if (openMusicaBtn) openMusicaBtn.addEventListener('click', openModal);

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    if (modalMusica) {
        modalMusica.addEventListener('click', e => {
            if (e.target === modalMusica) closeModal();
        });
    }

    // Inicialização direta no modo Revista 3D (Spread)
    setViewMode('spread');

})();
