/**
 * EM MINHA PELE — Revista Digital (Modo Editorial 3D & Spread)
 * 1. Visualizador fiel ao Figma (frame "V1") com páginas duplas (spreads), vinco de lombada e sombra de relevo
 * 2. Animação 3D de virar página por hardware acceleration (CSS 3D / rotateY) com iluminação dinâmica
 * 3. Leitura narrada com acompanhamento visual do texto
 * 4. Interações originais: Gráfico GEMAA/UERJ, Modal Chico César com QR Code, e links do Índice
 */

(function () {
    'use strict';

    const PAGE_W = 595;
    const PAGE_H = 842;
    const root = document.documentElement;
    document.querySelector('link[rel="stylesheet"][href="styles.css"]').href = 'styles.css?v=20261018-index-spacing';
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
        isFlipping: false
    };
    let pendingPage = null;

    // The reader preserves index.html and applies interaction and layout corrections here.
    const icons = {
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        close: '<path d="m6 6 12 12M18 6 6 18"/>',
        expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
        spread: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>',
        single: '<rect x="6" y="3" width="12" height="18" rx="2"/>',
        continuous: '<path d="M6 3h12v7H6zM6 14h12v7H6z"/>',
        options: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/>',
        minus: '<path d="M5 12h14"/>',
        plus: '<path d="M5 12h14M12 5v14"/>',
        left: '<path d="m14 6-6 6 6 6"/>',
        right: '<path d="m10 6 6 6-6 6"/>',
        sound: '<path d="m11 4-6 5H2v6h3l6 5V4Z"/><path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
        mute: '<path d="m11 4-6 5H2v6h3l6 5V4Z"/><path d="m16 9 6 6m0-6-6 6"/>'
    };
    const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
    const readerButton = (id, name, label, extra = '') => `<button type="button" id="${id}" class="reader-button" title="${label}" aria-label="${label}" ${extra}>${icon(name)}</button>`;
    const stage = document.createElement('div');
    stage.className = 'reader-stage';
    stage.setAttribute('aria-label', 'Área de leitura');
    revista.before(stage);
    stage.appendChild(revista);

    const footer = document.createElement('footer');
    footer.className = 'reader-footer';
    footer.innerHTML = `
        <div class="reader-meta">
            <button type="button" id="reader-index-button" class="reader-button" title="Sumário" aria-label="Abrir sumário" aria-expanded="false" aria-controls="reader-index">${icon('menu')}</button>
            <div class="reader-location"><a class="reader-brand" href="#p-capa" aria-label="Em Minha Pele — voltar à capa">Em minha pele</a><span id="reader-section">Capa</span></div>
        </div>
        <nav class="reader-control-group reader-paging" aria-label="Navegação de páginas"><span id="reader-prev-slot"></span><output id="cur-page-num" aria-live="polite" aria-atomic="true"></output><span id="reader-next-slot"></span></nav>
        <details class="reader-tools" id="reader-tools" ${window.innerWidth >= 900 ? 'open' : ''}>
            <summary class="reader-tools-toggle" aria-label="Opções de leitura">${icon('options')}<span>Opções</span></summary>
            <div class="reader-options" role="group" aria-label="Opções de leitura">
            <div class="reader-control-group reader-view" role="group" aria-label="Modo de leitura">
                ${readerButton('reader-spread', 'spread', 'Páginas duplas', 'data-view-mode="spread"')}
                ${readerButton('reader-single', 'single', 'Página única', 'data-view-mode="single"')}
                ${readerButton('reader-continuous', 'continuous', 'Leitura contínua', 'data-view-mode="continuous"')}
            </div>
            <div class="reader-control-group reader-zoom" role="group" aria-label="Zoom">
                ${readerButton('btn-zoom-out', 'minus', 'Diminuir zoom')}
                <button type="button" id="btn-zoom-fit" class="reader-fit" title="Ajustar à tela" aria-label="Ajustar à tela"><span id="zoom-val">100%</span></button>
                ${readerButton('btn-zoom-in', 'plus', 'Aumentar zoom')}
            </div>
            ${readerButton('btn-sound-toggle', 'sound', 'Ouvir revista', 'aria-pressed="false" aria-controls="reader-narration"')}
            ${readerButton('btn-fullscreen', 'expand', 'Entrar em tela cheia')}
            </div>
        </details>
        <div class="reader-progress"><span>01</span><input id="reader-page-range" type="range" min="1" max="${totalPages}" value="1" aria-label="Ir para uma página"><span>${String(totalPages).padStart(2, '0')}</span></div>`;
    document.body.appendChild(footer);
    const readerTools = document.getElementById('reader-tools');
    let toolsWide = window.innerWidth >= 900;
    document.addEventListener('click', event => {
        if (!toolsWide && !readerTools.contains(event.target)) readerTools.open = false;
    });
    ['prev', 'next'].forEach(direction => {
        const button = document.getElementById(`btn-${direction}`);
        button.className = 'reader-button';
        button.innerHTML = icon(direction === 'prev' ? 'left' : 'right');
        button.title = direction === 'prev' ? 'Página anterior' : 'Próxima página';
        document.getElementById(`reader-${direction}-slot`).appendChild(button);
    });

    const backdrop = document.createElement('button');
    backdrop.className = 'reader-index-backdrop';
    backdrop.setAttribute('aria-label', 'Fechar sumário');
    backdrop.hidden = true;
    const drawer = document.createElement('aside');
    drawer.id = 'reader-index';
    drawer.className = 'reader-index';
    drawer.hidden = true;
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', 'Sumário da edição');
    drawer.innerHTML = `<div class="reader-index-heading"><div><span class="reader-eyebrow">EDIÇÃO 01 · ${totalPages} PÁGINAS</span><h2>Dentro desta edição</h2></div>${readerButton('reader-index-close', 'close', 'Fechar sumário')}</div><nav class="reader-index-list" aria-label="Páginas da revista"></nav><p class="reader-index-note">Escolha uma página para continuar a leitura.</p>`;
    const indexList = drawer.querySelector('nav');
    slots.forEach((slot, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'reader-index-item';
        const number = document.createElement('span');
        number.textContent = String(i + 1).padStart(2, '0');
        const title = document.createElement('span');
        title.textContent = slot.querySelector('.page').getAttribute('aria-label');
        button.append(number, title);
        button.addEventListener('click', () => {
            setIndexOpen(false);
            goToPage(i);
        });
        indexList.appendChild(button);
    });
    document.body.append(backdrop, drawer);
    function setIndexOpen(open) {
        drawer.hidden = !open;
        backdrop.hidden = !open;
        document.getElementById('reader-index-button').setAttribute('aria-expanded', String(open));
        if (open) {
            const current = drawer.querySelector('[aria-current="page"]');
            (current || document.getElementById('reader-index-close')).focus();
            if (current) current.scrollIntoView({ block: 'nearest' });
        } else {
            document.getElementById('reader-index-button').focus();
        }
    }
    document.getElementById('reader-index-button').addEventListener('click', () => setIndexOpen(drawer.hidden));
    document.getElementById('reader-index-close').addEventListener('click', () => setIndexOpen(false));
    backdrop.addEventListener('click', () => setIndexOpen(false));
    document.getElementById('reader-page-range').addEventListener('change', e => goToPage(Number(e.target.value) - 1));
    document.addEventListener('fullscreenchange', () => {
        const button = document.getElementById('btn-fullscreen');
        button.setAttribute('aria-label', document.fullscreenElement ? 'Sair da tela cheia' : 'Entrar em tela cheia');
        button.title = button.getAttribute('aria-label');
    });

    /* -------------------------------------------------------------
     * 2. CÁLCULO DE ESCALA RESPONSIVA
     * ----------------------------------------------------------- */
    function calcAutoScale() {
        const availableW = stage.clientWidth;
        const availableH = stage.clientHeight;

        if (state.viewMode === 'spread') {
            const targetW = PAGE_W * 2;
            const targetH = PAGE_H;
            const sW = (availableW - 16) / targetW;
            const sH = (availableH - 16) / targetH;
            return Math.max(0.1, Math.min(sW, sH));
        } else if (state.viewMode === 'single') {
            const sW = (availableW - 16) / PAGE_W;
            const sH = (availableH - 16) / PAGE_H;
            return Math.max(0.1, Math.min(sW, sH));
        } else {
            // Continuous
            if (availableW < 640) {
                return Math.max(0.1, (availableW - 32) / PAGE_W);
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
        const wide = window.innerWidth >= 900;
        if (wide !== toolsWide) { readerTools.open = wide; toolsWide = wide; }
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
        if (narration.active && !narration.following) stopNarration();
        if (state.isFlipping) return;
        if (targetSpreadIdx < 0 || targetSpreadIdx >= spreads.length) return;
        if (targetSpreadIdx === state.currentSpreadIndex) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            state.currentSpreadIndex = targetSpreadIdx;
            const spread = spreads[targetSpreadIdx];
            state.currentPage = spread.left !== null ? spread.left : spread.right;
            updateSpreadDisplay();
            return;
        }

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
            if (pendingPage !== null) {
                const nextPage = pendingPage;
                pendingPage = null;
                goToPage(nextPage);
            }
        }, 580);
    }

    /* -------------------------------------------------------------
     * 5. MODOS DE VISUALIZAÇÃO
     * ----------------------------------------------------------- */
    function setViewMode(mode) {
        if (state.isFlipping) return;
        state.viewMode = mode;
        revista.classList.remove('revista--continuous', 'revista--single', 'revista--spread');
        revista.classList.add(`revista--${mode}`);

        document.querySelectorAll('[data-view-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.viewMode === mode);
            btn.setAttribute('aria-pressed', String(btn.dataset.viewMode === mode));
        });

        if (mode === 'spread') {
            state.currentSpreadIndex = spreads.findIndex(s => s.left === state.currentPage || s.right === state.currentPage);
            const spread = spreads[state.currentSpreadIndex];
            state.currentPage = spread.left !== null ? spread.left : spread.right;
            updateSpreadDisplay();
        } else {
            if (placeholderSlot.parentElement) placeholderSlot.remove();
            slots.forEach(s => s.classList.remove('is-spread-left', 'is-spread-right', 'is-capa-spread', 'is-contracapa-spread'));
            updatePageVisibility();
        }

        applyScale();
        updatePageCounter();
        if (mode === 'continuous') slots[state.currentPage].scrollIntoView({ block: 'start' });
        else stage.scrollTop = 0;
    }

    function goToPage(pageIdx) {
        if (narration.active && !narration.following) stopNarration();
        if (state.isFlipping) { pendingPage = pageIdx; return; }
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
        const page = slots[state.currentPage].querySelector('.page');
        document.getElementById('reader-section').textContent = page.getAttribute('aria-label');
        const range = document.getElementById('reader-page-range');
        range.value = String(state.currentPage + 1);
        range.setAttribute('aria-valuetext', `Página ${state.currentPage + 1} de ${totalPages}: ${page.getAttribute('aria-label')}`);
        range.style.setProperty('--reader-progress', `${state.currentPage / (totalPages - 1) * 100}%`);
        drawer.querySelectorAll('.reader-index-item').forEach((button, i) => {
            if (i === state.currentPage) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        });
        setClosedState(state.currentSpreadIndex);
    }

    // Monitora scroll no modo contínuo
    let scrollTimeout;
    stage.addEventListener('scroll', () => {
        if (state.viewMode !== 'continuous') return;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const stageRect = stage.getBoundingClientRect();
            const middleY = stageRect.top + stageRect.height / 2;
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
        if (e.target.closest('button, a, .hotspot, input, select, .box-grafico, .photo-carousel')) return;

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
        if (e.key === 'Escape' && !toolsWide && readerTools.open) {
            readerTools.open = false;
            readerTools.querySelector('summary').focus();
            return;
        }
        if (!drawer.hidden) {
            if (e.key === 'Escape') { setIndexOpen(false); return; }
            if (e.key === 'Tab') {
                const buttons = Array.from(drawer.querySelectorAll('button'));
                const first = buttons[0];
                const last = buttons[buttons.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
            return;
        }
        if (e.target.closest('input, select, textarea') || !modalMusica.hidden) {
            if (e.key === 'Escape') closeModal();
            if (e.key === 'Tab' && !modalMusica.hidden) {
                const first = modalMusica.querySelector('[data-close]');
                const last = modalMusica.querySelector('#link-musica');
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
            return;
        }
        if (e.key === 'Escape') closeModal();

        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            e.preventDefault();
            if (state.viewMode === 'spread') {
                flipToSpread(state.currentSpreadIndex + 1, 'next');
            } else {
                goToPage(state.currentPage + 1);
            }
        }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
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
        boxGrafico.setAttribute('aria-hidden', String(!isOpen));
        boxGrafico.setAttribute('tabindex', isOpen ? '0' : '-1');
        if (isOpen) boxGrafico.focus();
        else if (toggleGraficoBtn) toggleGraficoBtn.focus();
        if (toggleGraficoBtn) {
            toggleGraficoBtn.setAttribute('aria-expanded', String(isOpen));
        }
    }

    if (toggleGraficoBtn) toggleGraficoBtn.addEventListener('click', toggleGrafico);
    if (boxGrafico) boxGrafico.addEventListener('click', toggleGrafico);

    const modalMusica = document.getElementById('modal-musica');
    const openMusicaBtn = document.querySelector('[data-open="modal-musica"]');
    const songUrl = 'https://www.youtube.com/watch?v=8AAWqjp_AVU';
    const qrImg = document.getElementById('qr-musica');
    const linkMusica = document.getElementById('link-musica');

    if (qrImg) {
        qrImg.src = 'assets/qr-musica.png';
    }
    if (linkMusica) {
        linkMusica.href = songUrl;
    }

    function openModal() {
        if (!modalMusica) return;
        modalMusica.removeAttribute('hidden');
        requestAnimationFrame(() => {
            modalMusica.classList.add('is-open');
            modalMusica.querySelector('[data-close]').focus();
        });
    }

    function closeModal() {
        if (!modalMusica || modalMusica.hidden) return;
        modalMusica.classList.remove('is-open');
        setTimeout(() => modalMusica.setAttribute('hidden', ''), 250);
        if (openMusicaBtn) openMusicaBtn.focus();
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

    /* V1 interactions: enrich the reader while preserving the original HTML file. */
    const indexGrid = document.createElement('nav');
    indexGrid.className = 'idx-grid';
    indexGrid.setAttribute('aria-label', 'Artigos da revista');
    document.querySelectorAll('#p-indice > .idx-item').forEach(item => indexGrid.appendChild(item));
    document.getElementById('p-indice').appendChild(indexGrid);
    document.querySelector('#p-autores img[alt="Gustavo H L Munhoz"]').src = 'assets/autor-gustavo.png';
    document.querySelectorAll('#p-autores .autor-foto').forEach((photo, index) => {
        if (index === 1 || index === 4) photo.style.left = '279px';
        if (index >= 3) photo.style.top = '610px';
    });
    const editorialMask = document.querySelectorAll('#p-editorial > img')[1];
    editorialMask.style.cssText = 'left:287px;top:-16px;width:122px;height:164px;border-radius:0;clip-path:circle(59px at 61px 87px)';
    const screenPortrait = document.querySelector('#p-tela img');
    screenPortrait.parentElement.style.cssText = 'left:-50px;top:301px;width:404px;height:252px;overflow:hidden';
    screenPortrait.style.cssText = 'left:90.1px;top:-71.41px;width:299.958px;height:376.018px';
    const lastPortrait = document.querySelector('#p-mudar > img');
    lastPortrait.src = 'assets/capa-fundo.png';
    lastPortrait.style.cssText = 'left:316px;top:334.24px;width:283px;height:478.16px;clip-path:inset(77.76px 0 .4px)';
    const frontCover = document.getElementById('p-capa');
    frontCover.querySelector('img').src = 'assets/capa-fundo.png';
    const coverCutout = document.createElement('img');
    coverCutout.className = 'img cover-cutout';
    coverCutout.src = 'assets/capa-recorte.png';
    coverCutout.alt = '';
    coverCutout.setAttribute('aria-hidden', 'true');
    coverCutout.style.cssText = 'left:-5px;top:-161px;width:602px;height:1015px';
    frontCover.querySelector('h1').after(coverCutout);
    const memoryPhoto = document.querySelector('#p-memoria > img');
    memoryPhoto.src = 'assets/memoria-historia.png';
    memoryPhoto.alt = 'Fotografias históricas de cuidado e penteado dos cabelos negros';
    memoryPhoto.style.cssText = 'left:0;top:110px;width:242px;height:185px';

    function createCarousel(target, files, label, geometry) {
        const carousel = document.createElement('div');
        carousel.className = 'photo-carousel';
        carousel.style.cssText = geometry || target.style.cssText;
        carousel.setAttribute('role', 'region');
        carousel.setAttribute('aria-roledescription', 'carrossel');
        carousel.setAttribute('aria-label', label);
        const photo = document.createElement('img');
        photo.className = 'photo-carousel__image';
        photo.width = 306;
        photo.height = 219;
        photo.decoding = 'async';
        const controls = document.createElement('div');
        controls.className = 'photo-carousel__controls';
        const previous = document.createElement('button');
        previous.type = 'button';
        previous.innerHTML = icon('left');
        previous.setAttribute('aria-label', 'Foto anterior — ' + label);
        const count = document.createElement('span');
        count.className = 'photo-carousel__count';
        const next = document.createElement('button');
        next.type = 'button';
        next.innerHTML = icon('right');
        next.setAttribute('aria-label', 'Próxima foto — ' + label);
        const pause = document.createElement('button');
        pause.type = 'button';
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let paused = reducedMotion.matches;
        let current = 0;
        let timer;
        let visible = false;
        let hovering = false;
        let focused = false;
        function show(index) {
            current = (index + files.length) % files.length;
            photo.src = 'assets/' + files[current] + '.png';
            photo.alt = label + ' — fotografia ' + (current + 1) + ' de ' + files.length;
            count.textContent = (current + 1) + ' / ' + files.length;
            carousel.dataset.slide = String(current + 1);
            // Load the next photograph during the five-second viewing interval.
            const upcoming = document.createElement('img');
            upcoming.src = 'assets/' + files[(current + 1) % files.length] + '.png';
        }
        function schedule() {
            clearInterval(timer);
            pause.textContent = paused ? '▶' : 'Ⅱ';
            pause.setAttribute('aria-label', (paused ? 'Iniciar' : 'Pausar') + ' apresentação — ' + label);
            pause.setAttribute('aria-pressed', String(paused));
            count.setAttribute('aria-live', paused ? 'polite' : 'off');
            if (!paused && visible && !hovering && !focused && !document.hidden) {
                timer = setInterval(() => show(current + 1), 5000);
            }
        }
        previous.addEventListener('click', () => { show(current - 1); schedule(); });
        next.addEventListener('click', () => { show(current + 1); schedule(); });
        pause.addEventListener('click', () => { paused = !paused; schedule(); });
        carousel.addEventListener('pointerenter', () => { hovering = true; schedule(); });
        carousel.addEventListener('pointerleave', () => { hovering = false; schedule(); });
        carousel.addEventListener('focusin', () => { focused = true; schedule(); });
        carousel.addEventListener('focusout', e => {
            focused = carousel.contains(e.relatedTarget);
            schedule();
        });
        carousel.addEventListener('keydown', e => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            e.stopPropagation();
            show(current + (e.key === 'ArrowRight' ? 1 : -1));
            schedule();
        });
        document.addEventListener('visibilitychange', schedule);
        reducedMotion.addEventListener('change', e => { paused = e.matches; schedule(); });
        controls.append(previous, count, next, pause);
        carousel.append(photo, controls);
        target.replaceWith(carousel);
        show(0);
        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            schedule();
        }, { root: stage, threshold: 0.2 }).observe(carousel);
        schedule();
    }

    createCarousel(document.querySelector('#p-marcha > img'),
        ['marcha-14', 'marcha-15', 'marcha-16', 'marcha-17', 'marcha-18'], 'Marcha do Orgulho Crespo',
        'left:323px;top:138px;width:303px;height:227px');
    createCarousel(document.querySelector('#p-existimos > img'),
        ['tombamento-10', 'transicao-20', 'tombamento-21', 'tombamento-22', 'tombamento-23', 'tombamento-24', 'tombamento-26'],
        'Geração Tombamento', 'left:314px;top:197px;width:306px;height:219px');
    createCarousel(document.querySelector('#p-existimos > .bg:last-of-type'),
        ['transicao-19', 'transicao-20', 'transicao-rectangle10'], 'Transição capilar',
        'left:-7px;top:653px;width:305px;height:189px');

    openMusicaBtn.innerHTML = '<span class="interaction-label">' + icon('sound') + 'Ouvir Chico César ↗</span>';
    openMusicaBtn.style.cssText = 'left:272px;top:418px;width:301px;height:24px;z-index:7';
    toggleGraficoBtn.innerHTML = '<span>Ver gráfico · GEMAA/UERJ ↗</span>';
    toggleGraficoBtn.classList.add('interaction-action');
    toggleGraficoBtn.style.cssText = 'left:332px;top:110px;width:245px;height:27px';
    boxGrafico.setAttribute('role', 'button');
    boxGrafico.setAttribute('tabindex', '-1');
    boxGrafico.setAttribute('aria-hidden', 'true');
    boxGrafico.setAttribute('aria-label', 'Fechar gráfico GEMAA/UERJ');
    boxGrafico.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); toggleGrafico(); }
    });

    const makeupPhoto = document.querySelector('#p-tons > img');
    const makeupChart = document.createElement('div');
    makeupChart.className = 'makeup-chart';
    makeupChart.innerHTML = '<svg viewBox="0 0 314 375" role="img" aria-label="Percepção de 60 estudantes em Ocara: 53,3% tiveram dificuldade para achar base e 83,3% consideraram o mercado inacessível">' +
        '<text x="157" y="45" text-anchor="middle" class="chart-heading">Percepção dos 60 estudantes</text><text x="157" y="65" text-anchor="middle">em Ocara</text>' +
        [0, 20, 40, 60, 80, 100].map(n => '<path d="M25 ' + (304 - n * 2) + 'H314"/><text x="2" y="' + (308 - n * 2) + '" class="chart-axis">' + n + '%</text>').join('') +
        '<rect class="chart-bar" x="55" y="197.4" width="58" height="106.6"/><rect class="chart-bar" x="202" y="137.4" width="58" height="166.6"/>' +
        '<text x="55" y="343" class="chart-value">53,3%</text><text x="202" y="343" class="chart-value">83,3%</text>' +
        '<text x="25" y="365" class="chart-axis">Dificuldade para achar base</text><text x="180" y="365" class="chart-axis">Mercado inacessível</text></svg>' +
        '<button type="button" class="chart-replay">↻ Repetir animação</button>';
    makeupPhoto.replaceWith(makeupChart);
    function animateMakeupChart() {
        makeupChart.classList.remove('is-visible');
        requestAnimationFrame(() => requestAnimationFrame(() => makeupChart.classList.add('is-visible')));
    }
    makeupChart.querySelector('button').addEventListener('click', animateMakeupChart);
    new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) animateMakeupChart();
        else makeupChart.classList.remove('is-visible');
    }, { root: stage, threshold: 0.3 }).observe(makeupChart);

    const womenPage = document.getElementById('p-peso');
    const researchToggle = document.createElement('button');
    researchToggle.type = 'button';
    researchToggle.className = 'hotspot interaction-action';
    researchToggle.style.cssText = 'left:320px;top:385px;width:252px;height:27px';
    researchToggle.textContent = 'Ver dados da pesquisa ↗';
    researchToggle.setAttribute('aria-expanded', 'false');
    researchToggle.setAttribute('aria-controls', 'women-research');
    const research = document.createElement('div');
    research.id = 'women-research';
    research.className = 'women-research';
    research.hidden = true;
    research.innerHTML = '<h3>Cabelos sem Limites, Como Nós</h3><p>1.001 mulheres pretas ou pardas, de cabelos crespos ou cacheados.</p>' +
        '<div><strong>70%</strong><span>percebem pressão para alisar</span><i style="--bar:70%"></i></div>' +
        '<div><strong>80%</strong><span>consideram o cabelo expressão</span><i style="--bar:80%"></i></div>' +
        '<small>Instituto Sumaúma e RPretas · 2024</small>';
    researchToggle.addEventListener('click', () => {
        research.hidden = !research.hidden;
        researchToggle.setAttribute('aria-expanded', String(!research.hidden));
        researchToggle.textContent = research.hidden ? 'Ver dados da pesquisa ↗' : 'Fechar dados da pesquisa ×';
    });
    womenPage.append(research, researchToggle);
    document.querySelectorAll('#p-politica p').forEach(paragraph => {
        paragraph.innerHTML = paragraph.innerHTML
            .replace('Lei 10.639/2003', '<a class="editorial-link" target="_blank" rel="noopener" href="https://www.planalto.gov.br/ccivil_03/leis/2003/l10.639.htm">Lei 10.639/2003 ↗</a>')
            .replace('Lei 11.645/2008', '<a class="editorial-link" target="_blank" rel="noopener" href="https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11645.htm">Lei 11.645/2008 ↗</a>');
    });

    const cover = document.getElementById('p-contracapa');
    cover.classList.add('page--closing');
    cover.innerHTML = '<p class="closing-edition">EDIÇÃO 1 - OUTUBRO 2026</p>' +
        '<h2 class="closing-title">EM<br>MINHA</h2><div class="closing-band"></div>' +
        '<p class="closing-skin">PELE</p><p class="closing-subtitle">O preço de não caber no padrão</p>' +
        '<blockquote class="closing-quote">“Reconhecer nossos traços é também recuperar o direito de existir com dignidade, beleza e autonomia”</blockquote>' +
        '<a class="closing-references" href="referencias.html">Acesse as nossas referências <span aria-hidden="true">→</span></a>';

    const politicalFolio = document.createElement('span');
    politicalFolio.className = 'pn w';
    document.getElementById('p-politica').appendChild(politicalFolio);
    slots.forEach((slot, index) => {
        slot.querySelector('.page').classList.toggle('page--verso', index % 2 === 1);
        const number = slot.querySelector('.pn');
        if (number && index >= 4) number.textContent = String(index - 1);
    });

    const makeupParagraphs = document.querySelectorAll('#p-tons > div.a > p');
    makeupParagraphs[1].textContent = 'Em Ocara, um estudo local com 60 estudantes registrou que 53,3% tiveram dificuldade para encontrar base e 83,3% consideraram o mercado inacessível. Os estudos mostram como a oferta pode falhar para quem está diante da prateleira.';
    makeupParagraphs[2].textContent = makeupParagraphs[2].textContent.replace('viáveis..', 'viáveis.');

    // Paragraph spacing must not depend on stacked line breaks.
    document.querySelectorAll('.page p').forEach(paragraph => {
        if (paragraph.closest('#p-editorial') && paragraph.style.whiteSpace === 'pre-line') return;
        if (/<br\s*\/?>(?:\s*<br\s*\/?>)+/i.test(paragraph.innerHTML)) {
            paragraph.innerHTML = paragraph.innerHTML.split(/<br\s*\/?>(?:\s*<br\s*\/?>)+/i)
                .map(text => '<span class="prose-paragraph">' + text.trim() + '</span>').join('');
        }
    });

    const synth = window.speechSynthesis;
    const narration = { active: false, paused: false, page: 0, unit: 0, units: [], generation: 0, following: false, timer: null };
    const narrationPanel = document.createElement('div');
    narrationPanel.id = 'reader-narration';
    narrationPanel.className = 'reader-narration';
    narrationPanel.hidden = true;
    narrationPanel.setAttribute('aria-label', 'Leitura da revista');
    narrationPanel.innerHTML = '<p id="narration-status" role="status" aria-live="polite"></p>' +
        '<button type="button" id="narration-pause">Pausar</button>' +
        '<button type="button" id="narration-next" aria-label="Ler próximo trecho">Próximo trecho</button>' +
        '<button type="button" id="narration-stop" aria-label="Encerrar leitura">×</button>';
    footer.appendChild(narrationPanel);
    const narrationStatus = document.getElementById('narration-status');
    const pauseNarrationButton = document.getElementById('narration-pause');
    let currentReadingElement = null;
    function clearReadingHighlight() {
        if (currentReadingElement) currentReadingElement.classList.remove('narration-current');
        currentReadingElement = null;
        if (window.CSS && window.CSS.highlights) window.CSS.highlights.delete('spoken-text');
    }
    function updateNarrationControls() {
        const playing = narration.active && !narration.paused;
        const label = narration.active ? (playing ? 'Pausar leitura' : 'Continuar leitura') : 'Ouvir revista';
        btnSoundToggle.title = label;
        btnSoundToggle.setAttribute('aria-label', label);
        btnSoundToggle.setAttribute('aria-pressed', String(playing));
        pauseNarrationButton.textContent = narration.paused ? 'Continuar' : 'Pausar';
        pauseNarrationButton.disabled = !narration.active;
    }
    function stopNarration(hide = true) {
        narration.active = false;
        narration.paused = false;
        narration.generation++;
        clearTimeout(narration.timer);
        if (synth) synth.cancel();
        clearReadingHighlight();
        narrationPanel.hidden = hide;
        root.classList.toggle('is-narrating', !hide);
        updateNarrationControls();
        applyScale();
    }
    function readingUnits(page) {
        const elements = Array.from(page.querySelectorAll('h1,h2,h3,p,blockquote,a.idx-item'))
            .filter(element => !element.closest('[aria-hidden="true"],button,.photo-carousel,.box-grafico,.women-research,[hidden]') &&
                !element.parentElement.closest('p,blockquote') && element.textContent.trim());
        const heading = page.querySelector('h1,h2');
        if (heading && elements.includes(heading)) {
            elements.splice(elements.indexOf(heading), 1);
            elements.unshift(heading);
        }
        return elements.flatMap(element => {
            let raw = '';
            const positions = [];
            function collect(node) {
                if (node.nodeType === 3) {
                    positions.push({ node, start: raw.length, end: raw.length + node.textContent.length });
                    raw += node.textContent;
                } else if (node.nodeType === 1 && node.getAttribute('aria-hidden') !== 'true') {
                    if (node.tagName === 'BR') raw += '\n';
                    else {
                        if (node.classList.contains('prose-paragraph') && raw) raw += '\n';
                        if (node.classList.contains('idx-t') && raw) raw += ' ';
                        node.childNodes.forEach(collect);
                    }
                }
            }
            collect(element);
            const sentences = window.Intl && window.Intl.Segmenter ?
                Array.from(new window.Intl.Segmenter('pt-BR', { granularity: 'sentence' }).segment(raw), item => ({ text: item.segment, start: item.index })) :
                Array.from(raw.matchAll(/[^.!?]+(?:[.!?]+|$)/g), item => ({ text: item[0], start: item.index }));
            return sentences.filter(item => item.text.trim()).map((item, index) => {
                const start = item.start + item.text.length - item.text.trimStart().length;
                const prefix = page.id === 'p-editorial' && element === page.querySelector('p') && index === 0 ? 'N' : '';
                return { element, positions, start, text: prefix + item.text.trim(), prefix: prefix.length };
            });
        });
    }
    function highlightReading(unit, offset = 0, length = unit.text.length) {
        clearReadingHighlight();
        currentReadingElement = unit.element;
        unit.element.classList.add('narration-current');
        if (!window.Highlight || !window.CSS || !window.CSS.highlights) return;
        const start = unit.start + Math.max(0, offset - unit.prefix);
        const end = start + length;
        const first = unit.positions.find(position => position.end > start);
        const last = unit.positions.find(position => position.end >= end) || unit.positions[unit.positions.length - 1];
        if (!first || !last) return;
        const range = document.createRange();
        range.setStart(first.node, Math.max(0, start - first.start));
        range.setEnd(last.node, Math.min(last.node.textContent.length, end - last.start));
        window.CSS.highlights.set('spoken-text', new window.Highlight(range));
    }
    function speakCurrentUnit() {
        if (!narration.active) return;
        if (narration.unit >= narration.units.length) {
            if (narration.page >= totalPages - 1) {
                stopNarration(false);
                narrationStatus.textContent = 'Leitura concluída.';
                return;
            }
            beginNarrationPage(narration.page + 1);
            return;
        }
        const unit = narration.units[narration.unit];
        const generation = ++narration.generation;
        const utterance = new window.SpeechSynthesisUtterance(unit.text);
        utterance.lang = 'pt-BR';
        utterance.rate = 0.95;
        const voices = synth.getVoices();
        const voice = voices.find(item => item.lang.replace('_', '-').toLowerCase() === 'pt-br') || voices.find(item => /^pt\b/i.test(item.lang));
        if (voice) utterance.voice = voice;
        utterance.onstart = () => {
            if (generation !== narration.generation) return;
            highlightReading(unit);
            if (state.viewMode === 'continuous' || state.zoomMode === 'custom') unit.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        };
        utterance.onboundary = event => {
            if (generation !== narration.generation || event.name !== 'word') return;
            const word = unit.text.slice(event.charIndex).match(/^\S+/);
            highlightReading(unit, event.charIndex, event.charLength || (word ? word[0].length : 1));
        };
        utterance.onend = () => {
            if (generation !== narration.generation || !narration.active) return;
            narration.unit++;
            speakCurrentUnit();
        };
        utterance.onerror = event => {
            if (generation !== narration.generation || event.error === 'canceled' || event.error === 'interrupted') return;
            stopNarration(false);
            narrationStatus.textContent = 'Não foi possível iniciar a voz. Verifique as vozes em português disponíveis no seu navegador.';
        };
        narrationStatus.textContent = 'Lendo: ' + slots[narration.page].querySelector('.page').getAttribute('aria-label');
        highlightReading(unit);
        synth.speak(utterance);
    }
    function beginNarrationPage(pageIndex) {
        narration.page = pageIndex;
        narration.unit = 0;
        narration.units = readingUnits(slots[pageIndex].querySelector('.page'));
        narration.following = true;
        goToPage(pageIndex);
        narration.following = false;
        if (state.isFlipping) {
            const generation = narration.generation;
            narration.timer = setTimeout(() => { if (generation === narration.generation) speakCurrentUnit(); }, 650);
        } else speakCurrentUnit();
    }
    function toggleNarration() {
        narrationPanel.hidden = false;
        root.classList.add('is-narrating');
        applyScale();
        if (!synth || !window.SpeechSynthesisUtterance) {
            narrationStatus.textContent = 'A leitura em voz alta não está disponível neste navegador. Abra a revista no Chrome ou Edge.';
            updateNarrationControls();
            return;
        }
        if (!narration.active) {
            synth.cancel();
            narration.active = true;
            narration.paused = false;
            beginNarrationPage(state.currentPage);
        } else {
            narration.paused = !narration.paused;
            if (narration.paused) synth.pause();
            else synth.resume();
        }
        updateNarrationControls();
    }
    btnSoundToggle.addEventListener('click', toggleNarration);
    pauseNarrationButton.addEventListener('click', toggleNarration);
    document.getElementById('narration-stop').addEventListener('click', () => { stopNarration(); btnSoundToggle.focus(); });
    document.getElementById('narration-next').addEventListener('click', () => {
        if (!narration.active) return;
        narration.generation++;
        clearTimeout(narration.timer);
        synth.cancel();
        narration.paused = false;
        narration.unit++;
        speakCurrentUnit();
        updateNarrationControls();
    });
    window.addEventListener('pagehide', () => stopNarration());

    const initialPageId = location.hash.slice(1);
    // A single page fits small screens; desktop opens the original spread view.
    setViewMode(window.innerWidth < 760 ? 'single' : 'spread');
    const initialPage = slots.findIndex(slot => slot.querySelector('.page').id === initialPageId);
    if (initialPage > 0) goToPage(initialPage);

})();
