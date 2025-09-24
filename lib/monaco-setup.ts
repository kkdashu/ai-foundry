"use client"

// Register Monaco language contributions for syntax highlighting.
// Basic tokenization for common web languages (keeps setup simple, no workers required)
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution'
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution'
// JSON 没有 basic-languages 版本，使用内置 language 贡献（通常可直接工作）
import 'monaco-editor/esm/vs/language/json/monaco.contribution'

// Basic tokenization for many other languages
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution'
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution'
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution'
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution'
import 'monaco-editor/esm/vs/basic-languages/go/go.contribution'
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution'
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution'
import 'monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution'
// import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution'
// Keep the list conservative for broad Monaco versions. Add more as needed.
