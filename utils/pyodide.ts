let pyodideInstance: any = null;

export const loadPyodide = async () => {
    if (pyodideInstance) return pyodideInstance;

    // @ts-ignore
    if (!window.loadPyodide) {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
        document.body.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
    }

    // @ts-ignore
    pyodideInstance = await window.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
    });

    return pyodideInstance;
};

export const runPythonArgs = async (code: string, context: any = {}) => {
    const pyodide = await loadPyodide();

    // Redirect stdout/stderr
    let stdout: string[] = [];
    pyodide.setStdout({ batched: (msg: string) => stdout.push(msg) });
    pyodide.setStderr({ batched: (msg: string) => stdout.push(msg) });

    // Load context variables
    for (const [key, value] of Object.entries(context)) {
        pyodide.globals.set(key, value);
    }

    try {
        await pyodide.runPythonAsync(code);
        return { output: stdout.join('\n'), error: null };
    } catch (error: any) {
        let errorMsg = error.toString();

        // Swallowing SystemExit: True/0 as it's a normal exit for unittest/scripts
        if (errorMsg.includes('SystemExit:')) {
            return { output: stdout.join('\n'), error: null };
        }

        // Clean up internal Pyodide stack trace
        const lines = errorMsg.split('\n');
        const cleanLines = lines.filter((line: string) =>
            !line.includes('/lib/python311.zip/_pyodide/') &&
            !line.startsWith('PythonError:') &&
            !line.includes('await CodeRunner(') &&
            !line.includes('coroutine = eval(')
        );

        return { output: stdout.join('\n'), error: cleanLines.join('\n').trim() };
    }
};
