import type { Energy } from './physics';

const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment = `
precision highp float;
uniform vec2 resolution;
uniform vec3 nodes[18];
uniform float time;
void main(){
  vec2 p=vec2(gl_FragCoord.x,resolution.y-gl_FragCoord.y);
  float field=0.;
  vec2 gradient=vec2(0.);
  for(int i=0;i<18;i++){
    vec2 d=p-nodes[i].xy;
    float dist2=dot(d,d)+5.;
    float r2=nodes[i].z*nodes[i].z;
    field+=r2/dist2;
    gradient+=d*r2/(dist2*dist2);
  }
  float ripple=sin(p.x*.035+time*.9)*sin(p.y*.044-time*.6)*.055;
  float edge=smoothstep(.89,1.01,field+ripple);
  if(edge<.002) discard;
  float rim=1.-smoothstep(1.,1.7,field);
  vec2 normal=normalize(gradient+vec2(.00001));
  float sheen=pow(max(0.,dot(normal,normalize(vec2(-.5,-.8)))),5.);
  vec3 core=vec3(.009,.012,.014);
  vec3 oil=mix(vec3(.095,.115,.12),vec3(.15,.13,.16),sin(time*.35+normal.x*2.)*.5+.5);
  vec3 color=core+oil*rim*(.3+sheen*.8);
  gl_FragColor=vec4(color,edge);
}`;

export class Renderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private resolution: WebGLUniformLocation | null;
  private nodes: WebGLUniformLocation | null;
  private time: WebGLUniformLocation | null;
  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error('这个浏览器无法启用 WebGL，请开启硬件加速或使用 Chrome。');
    this.gl = gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader failed');
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Renderer failed');
    gl.useProgram(program); this.program = program;
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    this.resolution = gl.getUniformLocation(program, 'resolution');
    this.nodes = gl.getUniformLocation(program, 'nodes[0]');
    this.time = gl.getUniformLocation(program, 'time');
  }
  resize(width: number, height: number) {
    // Cap render resolution: the smooth surface does not need full Retina pixel density.
    const scale = Math.min(1.5, window.devicePixelRatio || 1, 1400 / width);
    this.canvas.width = Math.round(width * scale); this.canvas.height = Math.round(height * scale);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  draw(energy: Energy) {
    const gl = this.gl, sx = this.canvas.width / energy.width, sy = this.canvas.height / energy.height;
    gl.useProgram(this.program);
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.resolution, this.canvas.width, this.canvas.height);
    gl.uniform3fv(this.nodes, new Float32Array(energy.particles.flatMap(p => [p.x * sx, p.y * sy, p.radius * sx])));
    gl.uniform1f(this.time, energy.time);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
