/**
 * EM MINHA PELE — Laboratório WebGL & Shaders
 * Implementação direta da WebGL API com GLSL para animação 3D de curvatura de página (Page Curl)
 * Desenvolvido para demonstrar aceleração por hardware e o pipeline gráfico da GPU:
 * Vertex Shader (deformação cilíndrica) -> Rasterização -> Fragment Shader (iluminação de Phong e texturização)
 */

(function () {
    'use strict';

    // Shaders em GLSL
    const VERTEX_SHADER_SOURCE = `
        attribute vec2 a_position;
        varying vec2 v_texCoord;
        varying vec3 v_normal;
        varying vec3 v_worldPos;
        varying float v_curlZ;

        uniform float u_progress;
        uniform float u_angle;
        uniform float u_radius;

        #define PI 3.14159265359

        void main() {
            v_texCoord = a_position;
            vec2 p = a_position;

            // Linha de dobra se move da direita para a esquerda: de 1.1 até -0.6
            float foldX = 1.1 - u_progress * 1.7;

            float cosA = cos(u_angle);
            float sinA = sin(u_angle);

            // Projeta o ponto no sistema de coordenadas rotacionado da dobra
            vec2 rotatedP = vec2(
                (p.x - foldX) * cosA - (p.y - 0.5) * sinA,
                (p.x - foldX) * sinA + (p.y - 0.5) * cosA
            );

            float d = rotatedP.x;
            float R = max(u_radius, 0.04);

            vec3 pos3D = vec3(p.x * 2.0 - 1.0, (1.0 - p.y) * 2.0 - 1.0, 0.0);
            vec3 normal = vec3(0.0, 0.0, 1.0);

            if (d > 0.0) {
                if (d < PI * R) {
                    // Ponto enrolando na superfície do cilindro
                    float theta = d / R;
                    float newD = R * sin(theta);
                    float z = R * (1.0 - cos(theta));

                    float dx = (newD - d) * cosA;
                    float dy = -(newD - d) * sinA;

                    pos3D.x += dx * 2.0;
                    pos3D.y += -dy * 2.0;
                    pos3D.z = z * 2.5;

                    vec3 cylNormal = vec3(sin(theta) * cosA, -sin(theta) * sinA, cos(theta));
                    normal = normalize(cylNormal);
                } else {
                    // Ponto totalmente virado para o outro lado
                    float excess = d - PI * R;
                    float newD = -excess;
                    float z = 2.0 * R;

                    float dx = (newD - d) * cosA;
                    float dy = -(newD - d) * sinA;

                    pos3D.x += dx * 2.0;
                    pos3D.y += -dy * 2.0;
                    pos3D.z = z * 2.5;

                    normal = vec3(0.0, 0.0, -1.0);
                }
            }

            v_normal = normal;
            v_worldPos = pos3D;
            v_curlZ = pos3D.z;

            // Projeção em perspectiva simples
            float zDist = 3.0;
            float persp = zDist / (zDist - pos3D.z * 0.5);

            gl_Position = vec4(pos3D.x * persp * 0.75, pos3D.y * persp * 0.85, pos3D.z * 0.1, 1.0);
        }
    `;

    const FRAGMENT_SHADER_SOURCE = `
        precision mediump float;

        varying vec2 v_texCoord;
        varying vec3 v_normal;
        varying vec3 v_worldPos;
        varying float v_curlZ;

        uniform sampler2D u_frontPage;
        uniform sampler2D u_backPage;
        uniform float u_wireframe;
        uniform float u_lighting;

        void main() {
            vec3 norm = normalize(v_normal);
            vec4 texColor;

            // Identifica se estamos vendo a frente ou o verso da folha
            if (norm.z < 0.0) {
                // Verso da página (espelhado horizontalmente)
                vec2 backCoord = vec2(1.0 - v_texCoord.x, v_texCoord.y);
                texColor = texture2D(u_backPage, backCoord);
                texColor.rgb *= vec3(0.96, 0.93, 0.90); // leve tonalidade de verso de papel
                norm = -norm;
            } else {
                texColor = texture2D(u_frontPage, v_texCoord);
            }

            // Iluminação de Phong
            vec3 lightPos = vec3(0.4, 0.7, 2.5);
            vec3 lightDir = normalize(lightPos - v_worldPos);
            vec3 viewDir = vec3(0.0, 0.0, 1.0);

            float ambient = 0.50;
            float diff = max(dot(norm, lightDir), 0.0) * 0.50;

            vec3 halfDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(norm, halfDir), 0.0), 24.0) * 0.22;

            // Sombra suave sob a dobra
            float shadow = 1.0;
            if (v_curlZ > 0.05 && norm.z > 0.0) {
                shadow = clamp(1.0 - (v_curlZ * 0.5), 0.55, 1.0);
            }

            vec3 finalRgb = (texColor.rgb * (ambient + diff) + vec3(spec)) * shadow;

            if (u_lighting < 0.5) {
                finalRgb = texColor.rgb;
            }

            // Modo Wireframe (destaque visual das divisões calculadas pela GPU)
            if (u_wireframe > 0.5) {
                vec2 grid = fract(v_texCoord * 50.0);
                if (grid.x < 0.07 || grid.y < 0.07) {
                    finalRgb = mix(finalRgb, vec3(0.95, 0.75, 0.25), 0.85);
                }
            }

            gl_FragColor = vec4(finalRgb, 1.0);
        }
    `;

    // Texturas padrão sintetizadas caso as imagens ainda estejam carregando
    function createFallbackTexture(gl, text, bgColor, textColor) {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 724;
        const ctx = c.getContext('2d');

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 512, 724);

        ctx.fillStyle = textColor;
        ctx.font = 'bold 36px serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, 256, 360);

        ctx.font = '20px sans-serif';
        ctx.fillText('EM MINHA PELE — WebGL', 256, 410);

        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return tex;
    }

    function createTextureFromImage(gl, img) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return tex;
    }

    // Gerador da malha da página (Grid de Vértices)
    function createPageMesh(subdivisionsX = 60, subdivisionsY = 60) {
        const vertices = [];
        const indices = [];

        for (let y = 0; y <= subdivisionsY; y++) {
            const v = y / subdivisionsY;
            for (let x = 0; x <= subdivisionsX; x++) {
                const u = x / subdivisionsX;
                vertices.push(u, v);
            }
        }

        const rowStride = subdivisionsX + 1;
        for (let y = 0; y < subdivisionsY; y++) {
            for (let x = 0; x < subdivisionsX; x++) {
                const i0 = y * rowStride + x;
                const i1 = i0 + 1;
                const i2 = (y + 1) * rowStride + x;
                const i3 = i2 + 1;

                // Dois triângulos por quad
                indices.push(i0, i2, i1);
                indices.push(i1, i2, i3);
            }
        }

        return {
            vertices: new Float32Array(vertices),
            indices: new Uint16Array(indices),
            indexCount: indices.length
        };
    }

    class WebGLPageCurlLab {
        constructor(canvasId) {
            this.canvas = document.getElementById(canvasId);
            if (!this.canvas) return;

            this.gl = this.canvas.getContext('webgl', { antialias: true }) ||
                      this.canvas.getContext('experimental-webgl');

            if (!this.gl) {
                console.warn('WebGL não suportado pelo navegador.');
                return;
            }

            this.program = null;
            this.mesh = null;
            this.vbo = null;
            this.ibo = null;

            this.frontTexture = null;
            this.backTexture = null;

            // Parâmetros dos Shaders
            this.params = {
                progress: 0.35,
                angle: 15 * (Math.PI / 180),
                radius: 0.14,
                wireframe: false,
                lighting: true,
                animating: false
            };

            this.init();
        }

        init() {
            const gl = this.gl;

            // Compila shaders
            const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
            const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

            this.program = gl.createProgram();
            gl.attachShader(this.program, vs);
            gl.attachShader(this.program, fs);
            gl.linkProgram(this.program);

            if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
                console.error('Erro ao linkar programa WebGL:', gl.getProgramInfoLog(this.program));
                return;
            }

            // Localizações de atributos e uniforms
            this.loc = {
                a_position: gl.getAttribLocation(this.program, 'a_position'),
                u_progress: gl.getUniformLocation(this.program, 'u_progress'),
                u_angle: gl.getUniformLocation(this.program, 'u_angle'),
                u_radius: gl.getUniformLocation(this.program, 'u_radius'),
                u_wireframe: gl.getUniformLocation(this.program, 'u_wireframe'),
                u_lighting: gl.getUniformLocation(this.program, 'u_lighting'),
                u_frontPage: gl.getUniformLocation(this.program, 'u_frontPage'),
                u_backPage: gl.getUniformLocation(this.program, 'u_backPage')
            };

            // Gera malha de 60x60 subdivisões (3.600 vértices processados em paralelo)
            this.mesh = createPageMesh(60, 60);

            this.vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
            gl.bufferData(gl.ARRAY_BUFFER, this.mesh.vertices, gl.STATIC_DRAW);

            this.ibo = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.mesh.indices, gl.STATIC_DRAW);

            // Texturas iniciais
            this.frontTexture = createFallbackTexture(gl, 'Capa: Em Minha Pele', '#620909', '#F7F1E8');
            this.backTexture = createFallbackTexture(gl, 'Página 2: Editorial', '#562A13', '#F7F1E8');

            // Carrega imagens reais da revista
            this.loadTextureImages('assets/capa-revista.png', 'assets/nao-pede-licenca.png');

            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);
            gl.clearColor(0.12, 0.12, 0.12, 1.0);

            this.render();
        }

        loadTextureImages(frontSrc, backSrc) {
            const gl = this.gl;
            const frontImg = new Image();
            frontImg.onload = () => {
                this.frontTexture = createTextureFromImage(gl, frontImg);
                this.render();
            };
            frontImg.src = frontSrc;

            const backImg = new Image();
            backImg.onload = () => {
                this.backTexture = createTextureFromImage(gl, backImg);
                this.render();
            };
            backImg.src = backSrc;
        }

        compileShader(type, src) {
            const gl = this.gl;
            const shader = gl.createShader(type);
            gl.shaderSource(shader, src);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('Erro de compilação GLSL:', gl.getShaderInfoLog(shader));
            }
            return shader;
        }

        render() {
            if (!this.gl || !this.program) return;
            const gl = this.gl;

            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            gl.useProgram(this.program);

            // Passa os uniforms
            gl.uniform1f(this.loc.u_progress, this.params.progress);
            gl.uniform1f(this.loc.u_angle, this.params.angle);
            gl.uniform1f(this.loc.u_radius, this.params.radius);
            gl.uniform1f(this.loc.u_wireframe, this.params.wireframe ? 1.0 : 0.0);
            gl.uniform1f(this.loc.u_lighting, this.params.lighting ? 1.0 : 0.0);

            // Texturas
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.frontTexture);
            gl.uniform1i(this.loc.u_frontPage, 0);

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.backTexture);
            gl.uniform1i(this.loc.u_backPage, 1);

            // Atributos de Vértices
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
            gl.enableVertexAttribArray(this.loc.a_position);
            gl.vertexAttribPointer(this.loc.a_position, 2, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);

            // Desenha os triângulos na GPU
            gl.drawElements(gl.TRIANGLES, this.mesh.indexCount, gl.UNSIGNED_SHORT, 0);
        }

        startAnimation() {
            this.params.animating = !this.params.animating;
            let dir = 0.008;

            const loop = () => {
                if (!this.params.animating) return;
                this.params.progress += dir;
                if (this.params.progress >= 1.0) {
                    this.params.progress = 1.0;
                    dir = -0.008;
                } else if (this.params.progress <= 0.0) {
                    this.params.progress = 0.0;
                    dir = 0.008;
                }

                // Sincroniza slider com a animação
                const slider = document.getElementById('webgl-progress');
                const label = document.getElementById('val-progress');
                if (slider) slider.value = Math.round(this.params.progress * 100);
                if (label) label.textContent = `${Math.round(this.params.progress * 100)}%`;

                this.render();
                requestAnimationFrame(loop);
            };

            if (this.params.animating) loop();
        }
    }

    // Inicialização da interface do Laboratório WebGL
    let labInstance = null;

    function initWebGLModal() {
        const modal = document.getElementById('modal-webgl');
        const openBtn = document.getElementById('btn-webgl-lab');
        if (!modal) return;

        const codeVertexEl = document.getElementById('code-vertex');
        const codeFragmentEl = document.getElementById('code-fragment');
        if (codeVertexEl) codeVertexEl.textContent = VERTEX_SHADER_SOURCE.trim();
        if (codeFragmentEl) codeFragmentEl.textContent = FRAGMENT_SHADER_SOURCE.trim();

        function openLab() {
            modal.removeAttribute('hidden');
            if (!labInstance) {
                labInstance = new WebGLPageCurlLab('webgl-canvas');
                bindControls();
            } else {
                labInstance.render();
            }
        }

        function closeLab() {
            modal.setAttribute('hidden', '');
            if (labInstance && labInstance.params.animating) {
                labInstance.params.animating = false;
                const animBtn = document.getElementById('btn-webgl-animate');
                if (animBtn) animBtn.textContent = '▶ Animar Automático';
            }
        }

        if (openBtn) openBtn.addEventListener('click', openLab);

        modal.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', closeLab);
        });

        // Abas de Código / Explicação
        modal.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                const target = document.getElementById(btn.dataset.tab);
                if (target) target.classList.add('active');
            });
        });

        function bindControls() {
            const progInput = document.getElementById('webgl-progress');
            const progLabel = document.getElementById('val-progress');
            if (progInput) {
                progInput.addEventListener('input', e => {
                    labInstance.params.progress = e.target.value / 100;
                    if (progLabel) progLabel.textContent = `${e.target.value}%`;
                    labInstance.render();
                });
            }

            const angleInput = document.getElementById('webgl-angle');
            const angleLabel = document.getElementById('val-angle');
            if (angleInput) {
                angleInput.addEventListener('input', e => {
                    labInstance.params.angle = e.target.value * (Math.PI / 180);
                    if (angleLabel) angleLabel.textContent = `${e.target.value}°`;
                    labInstance.render();
                });
            }

            const radiusInput = document.getElementById('webgl-radius');
            const radiusLabel = document.getElementById('val-radius');
            if (radiusInput) {
                radiusInput.addEventListener('input', e => {
                    labInstance.params.radius = e.target.value / 100;
                    if (radiusLabel) radiusLabel.textContent = (e.target.value / 100).toFixed(2);
                    labInstance.render();
                });
            }

            const animBtn = document.getElementById('btn-webgl-animate');
            if (animBtn) {
                animBtn.addEventListener('click', () => {
                    labInstance.startAnimation();
                    animBtn.textContent = labInstance.params.animating ? '⏸ Pausar Animação' : '▶ Animar Automático';
                });
            }

            const wireBtn = document.getElementById('btn-webgl-wireframe');
            if (wireBtn) {
                wireBtn.addEventListener('click', () => {
                    labInstance.params.wireframe = !labInstance.params.wireframe;
                    wireBtn.classList.toggle('active', labInstance.params.wireframe);
                    labInstance.render();
                });
            }

            const lightBtn = document.getElementById('btn-webgl-light');
            if (lightBtn) {
                lightBtn.addEventListener('click', () => {
                    labInstance.params.lighting = !labInstance.params.lighting;
                    lightBtn.classList.toggle('active', !labInstance.params.lighting);
                    labInstance.render();
                });
            }

            const texSelect = document.getElementById('webgl-texture-select');
            if (texSelect) {
                texSelect.addEventListener('change', e => {
                    const val = e.target.value;
                    if (val === 'capa') {
                        labInstance.loadTextureImages('assets/capa-revista.png', 'assets/nao-pede-licenca.png');
                    } else if (val === 'licenca') {
                        labInstance.loadTextureImages('assets/nao-pede-licenca.png', 'assets/direito-existir.png');
                    } else if (val === 'anunciada') {
                        labInstance.loadTextureImages('assets/beleza-anunciada.png', 'assets/belo-historia.png');
                    } else if (val === 'editorial') {
                        labInstance.loadTextureImages('assets/tornar-se-negro.png', 'assets/belo-historia.png');
                    }
                });
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWebGLModal);
    } else {
        initWebGLModal();
    }

    window.WebGLPageCurlLab = WebGLPageCurlLab;
})();
