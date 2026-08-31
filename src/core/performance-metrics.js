(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  const MAX_SAMPLES = 3;
  const OPERATIONS = new Set(["catalog-first", "catalog-resync", "catalog-search", "catalog-filter"]);

  function create({
    documentLike = globalThis.document,
    windowLike = globalThis.window,
    performanceLike = globalThis.performance,
  } = {}) {
    let disposed = false;
    let target = null;
    let sequence = 0;
    const samples = new Map();
    const active = new Set();

    function now() {
      try {
        const value = performanceLike?.now?.();
        return Number.isFinite(value) ? value : null;
      } catch {
        return null;
      }
    }

    function isVisible() {
      try { return documentLike?.visibilityState !== "hidden"; } catch { return false; }
    }

    function publish() {
      if (!target?.setAttribute) return;
      const serializable = {};
      for (const [operation, operationSamples] of samples) serializable[operation] = operationSamples;
      try { target.setAttribute("data-fqmail-perf", JSON.stringify(serializable)); } catch { /* Metrics never block the reading workflow. */ }
    }

    function record(operation, count, startedAt, domEndedAt, endedAt, valid) {
      const operationSamples = samples.get(operation) || [];
      operationSamples.push({
        operation,
        count,
        seq: ++sequence,
        domMs: valid && Number.isFinite(startedAt) && Number.isFinite(domEndedAt)
          ? Math.max(0, domEndedAt - startedAt)
          : null,
        ms: valid && Number.isFinite(startedAt) && Number.isFinite(endedAt)
          ? Math.max(0, endedAt - startedAt)
          : null,
        valid: Boolean(valid),
      });
      samples.set(operation, operationSamples.slice(-MAX_SAMPLES));
      publish();
    }

    function attach(nextTarget) {
      target = nextTarget || null;
      publish();
      return target;
    }

    function begin(operation, count) {
      const normalizedOperation = String(operation || "");
      if (disposed || !OPERATIONS.has(normalizedOperation)) return null;
      for (const previous of [...active]) {
        if (previous.operation === normalizedOperation) previous.cancel();
      }
      const normalizedCount = Math.max(0, Number(count) || 0);
      const startedAt = now();
      let state = "open";
      let firstFrameId = null;
      let secondFrameId = null;
      let hiddenDuringMeasure = !isVisible();
      const onVisibilityChange = () => {
        if (!isVisible()) hiddenDuringMeasure = true;
      };
      const measure = {
        operation: normalizedOperation,
        finish() {
          if (state !== "open") return false;
          state = "waiting";
          const domEndedAt = now();
          const requestFrame = windowLike?.requestAnimationFrame?.bind(windowLike);
          if (!requestFrame || !Number.isFinite(startedAt) || !Number.isFinite(domEndedAt) || hiddenDuringMeasure || !isVisible()) {
            settleInvalid();
            return false;
          }
          try {
            firstFrameId = requestFrame(() => {
              if (state !== "waiting") return;
              try {
                secondFrameId = requestFrame(() => {
                  if (state !== "waiting") return;
                  const endedAt = now();
                  const valid = !disposed && !hiddenDuringMeasure && isVisible() && Number.isFinite(endedAt);
                  state = "settled";
                  cleanup();
                  record(normalizedOperation, normalizedCount, startedAt, domEndedAt, endedAt, valid);
                });
              } catch {
                settleInvalid();
              }
            });
          } catch {
            settleInvalid();
            return false;
          }
          return true;
        },
        cancel() {
          if (state === "settled") return false;
          settleInvalid();
          return true;
        },
      };
      function cleanup() {
        active.delete(measure);
        try { documentLike?.removeEventListener?.("visibilitychange", onVisibilityChange); } catch { /* Visibility cleanup is best effort. */ }
      }
      function cancelFrame(frameId) {
        if (frameId === null) return;
        try { windowLike?.cancelAnimationFrame?.(frameId); } catch { /* A missing frame must not affect the workflow. */ }
      }
      function settleInvalid() {
        if (state === "settled") return false;
        state = "settled";
        cancelFrame(firstFrameId);
        cancelFrame(secondFrameId);
        cleanup();
        record(normalizedOperation, normalizedCount, startedAt, null, null, false);
        return true;
      }
      try { documentLike?.addEventListener?.("visibilitychange", onVisibilityChange); } catch { /* Visibility timing is optional and cannot block the workflow. */ }
      active.add(measure);
      return measure;
    }

    function dispose() {
      if (disposed) return false;
      disposed = true;
      for (const measure of [...active]) measure.cancel();
      active.clear();
      return true;
    }

    return {attach, begin, dispose};
  }

  globalThis.Fqmail.performanceMetrics = {create, MAX_SAMPLES, OPERATIONS};
})();
