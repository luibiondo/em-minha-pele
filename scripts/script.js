/**
 * EM MINHA PELE — Scripts interativos
 * 1. Ajuste responsivo de escala (fit-to-screen)
 * 2. Visualizador com modos: Contínuo, Página Única e Página Dupla (Spread)
 * 3. Interação do Box de Estatísticas (GEMAA / UERJ) na pág. 8
 * 4. Modal com QR Code e Player para "Respeitem Meus Cabelos, Brancos" (Chico César)
 * 5. Navegação do Índice
 */

(function () {
    'use strict';

    const PAGE_W = 595;
    const PAGE_H = 842;
    const root = document.documentElement;
    const revista = document.querySelector('.revista');
    const slots = Array.from(document.querySelectorAll('.slot'));
    const totalPages = slots.length;

    // Estado do leitor
    const state = {
        zoomMode: 'auto',      // 'auto' | 'custom'
        customScale: 1,
        viewMode: 'continuous', // 'continuous' | 'single' | 'spread'
        currentPage: 0,
    };

    /* -------------------------------------------------------------
     * 1. ESCALA RESPONSIVA
     * ----------------------------------------------------------- */
    function calcAutoScale() {
        const availableW = window.innerWidth;
        const availableH = window.innerHeight;

        if (state.viewMode === 'spread' && availableW >= 1240) {
            // Duas páginas lado a lado
            const targetW = PAGE_W * 2 + 48;
            const targetH = PAGE_H + 120;
            const sW = (availableW - 64) / targetW;
            const sH = (availableH - 120) / targetH;
            return Math.min(1.1, Math.max(0.4, Math.min(sW, sH)));
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
     * 2. MODOS DE VISUALIZAÇÃO
     * ----------------------------------------------------------- */
    function setViewMode(mode) {
        state.viewMode = mode;
        revista.classList.remove('revista--continuous', 'revista--single', 'revista--spread');
        revista.classList.add(`revista--${mode}`);

        document.querySelectorAll('[data-view-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.viewMode === mode);
        });

        applyScale();
        updatePageVisibility();
    }

    function goToPage(idx) {
        state.currentPage = Math.max(0, Math.min(totalPages - 1, idx));
        updatePageVisibility();

        if (state.viewMode === 'continuous') {
            const target = slots[state.currentPage];
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        updatePageCounter();
    }

    function updatePageVisibility() {
        if (state.viewMode === 'single') {
            slots.forEach((s, i) => {
                s.style.display = i === state.currentPage ? 'block' : 'none';
            });
        } else if (state.viewMode === 'spread') {
            // Em spread: capa é avulsa (pág 0), depois duplas (1-2, 3-4, etc.)
            slots.forEach((s, i) => {
                let visible = false;
                if (state.currentPage === 0) {
                    visible = i === 0;
                } else {
                    const start = state.currentPage % 2 === 1 ? state.currentPage : state.currentPage - 1;
                    visible = i === start || i === start + 1;
                }
                s.style.display = visible ? 'block' : 'none';
            });
        } else {
            // Continuous: todas visíveis
            slots.forEach(s => (s.style.display = 'block'));
        }
    }

    function updatePageCounter() {
        const curLabel = document.getElementById('cur-page-num');
        if (!curLabel) return;

        if (state.viewMode === 'spread' && state.currentPage > 0) {
            const start = state.currentPage % 2 === 1 ? state.currentPage : state.currentPage - 1;
            const end = Math.min(totalPages, start + 2);
            curLabel.textContent = `${start + 1}–${end} / ${totalPages}`;
        } else {
            curLabel.textContent = `${state.currentPage + 1} / ${totalPages}`;
        }
    }

    // Monitora scroll no modo contínuo para atualizar contador da página atual
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
     * 3. GRÁFICO DO GEMAA / UERJ (Página 8)
     * "Quando clicar no box aparecer o gráfico" (anotação Figma)
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

    if (toggleGraficoBtn) {
        toggleGraficoBtn.addEventListener('click', toggleGrafico);
    }
    if (boxGrafico) {
        boxGrafico.addEventListener('click', toggleGrafico);
    }

    /* -------------------------------------------------------------
     * 4. MODAL COM QR CODE & MÚSICA (Página 6)
     * "Acho legal aparecer um QR Code pra pessoa ouvir a música..."
     * "Respeitem Meus Cabelos, Brancos" — Chico César
     * ----------------------------------------------------------- */
    const modalMusica = document.getElementById('modal-musica');
    const openMusicaBtn = document.querySelector('[data-open="modal-musica"]');
    const songUrl = 'https://www.youtube.com/watch?v=wX-y0Yh3g1g'; // Chico César - Respeitem Meus Cabelos, Brancos
    const qrImg = document.getElementById('qr-musica');
    const linkMusica = document.getElementById('link-musica');

    if (qrImg) {
        // Gera o QR Code com a API qrserver
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

    window.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
        if (state.viewMode !== 'continuous') {
            if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                const step = state.viewMode === 'spread' && state.currentPage > 0 ? 2 : 1;
                goToPage(state.currentPage + step);
            }
            if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                const step = state.viewMode === 'spread' && state.currentPage > 1 ? 2 : 1;
                goToPage(state.currentPage - step);
            }
        }
    });

    /* -------------------------------------------------------------
     * 5. NAVEGAÇÃO DO ÍNDICE & CLIQUE SUAVE
     * ----------------------------------------------------------- */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', e => {
            const targetId = anchor.getAttribute('href').slice(1);
            const targetEl = document.getElementById(targetId);
            if (!targetEl) return;
            e.preventDefault();

            const targetSlot = targetEl.closest('.slot');
            const targetIdx = slots.indexOf(targetSlot);

            if (state.viewMode !== 'continuous' && targetIdx !== -1) {
                goToPage(targetIdx);
            } else if (targetSlot) {
                targetSlot.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // Destaque visual temporário
            targetEl.classList.add('page-highlight');
            setTimeout(() => targetEl.classList.remove('page-highlight'), 1200);
        });
    });

    /* -------------------------------------------------------------
     * 6. CONTROLES DA BARRA DE FERRAMENTAS
     * ----------------------------------------------------------- */
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomFit = document.getElementById('btn-zoom-fit');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnFullscreen = document.getElementById('btn-fullscreen');

    if (btnZoomIn) {
        btnZoomIn.addEventListener('click', () => {
            const currentScale = parseFloat(root.style.getPropertyValue('--scale')) || 1;
            state.zoomMode = 'custom';
            state.customScale = Math.min(1.8, currentScale + 0.1);
            applyScale();
        });
    }

    if (btnZoomOut) {
        btnZoomOut.addEventListener('click', () => {
            const currentScale = parseFloat(root.style.getPropertyValue('--scale')) || 1;
            state.zoomMode = 'custom';
            state.customScale = Math.max(0.35, currentScale - 0.1);
            applyScale();
        });
    }

    if (btnZoomFit) {
        btnZoomFit.addEventListener('click', () => {
            state.zoomMode = 'auto';
            applyScale();
        });
    }

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            const step = state.viewMode === 'spread' && state.currentPage > 1 ? 2 : 1;
            goToPage(state.currentPage - step);
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            const step = state.viewMode === 'spread' && state.currentPage > 0 ? 2 : 1;
            goToPage(state.currentPage + step);
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

    // Inicialização
    applyScale();
    updatePageCounter();

})();
