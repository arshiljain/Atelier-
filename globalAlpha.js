function globalAlpha(p5, fn) {
  const baseShaders = ['_getLightShader', '_getColorShader', '_getNormalShader', '_getLineShader']

  fn.globalAlpha = function(alpha) {
    if (alpha === undefined) {
      return this._renderer.states.globalAlpha ?? 1
    }
    this._renderer.states.setValue('globalAlpha', alpha)
  }

  for (const uniformSetup of ['_setFillUniforms', '_setStrokeUniforms']) {
    const prevSetup = p5.Renderer3D.prototype[uniformSetup]
    p5.Renderer3D.prototype[uniformSetup] = function(shader) {
      prevSetup.call(this, shader)
      shader.setUniform('globalAlpha', this.states.globalAlpha ?? 1)
    }
  }

  const oldApplyColorBlend = p5.RendererGL.prototype._applyColorBlend
  p5.RendererGL.prototype._applyColorBlend = function(colors, hasTransparency) {
    return oldApplyColorBlend.call(this, colors, hasTransparency || (this.states.globalAlpha ?? 1) < 1)
  }

  const cacheKey = 'globalAlphaShaderCache'

  for (const shader of baseShaders) {
    const origBaseShader = p5.RendererGL.prototype[shader]
    p5.RendererGL.prototype[shader] = function() {
      if (!this[cacheKey]) this[cacheKey] = {}
      if (!this[cacheKey][shader]) {
        this[cacheKey][shader] = origBaseShader.call(this).modify({
          uniforms: {
            'float globalAlpha': null,
          },
          'vec4 getFinalColor': '(vec4 color, vec2 texCoord) { return color * vec4(1., 1., 1., globalAlpha); }',
        })
      }
      return this[cacheKey][shader]
    }
  }

  const prevBegin = p5.Framebuffer.prototype.begin
  p5.Framebuffer.prototype.begin = function() {
    prevBegin.call(this)
    this.renderer.states.setValue('globalAlpha', 1)
  }
}

if (typeof p5 !== 'undefined') {
  p5.registerAddon(globalAlpha)
}
