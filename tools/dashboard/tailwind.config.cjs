module.exports = {
  content: [require('node:path').join(__dirname, 'index.html')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vibe: {
          bg: '#0a0a0f', card: '#12121a', border: '#1e1e2e', accent: '#8b5cf6',
          green: '#22c55e', red: '#ef4444', yellow: '#eab308', blue: '#3b82f6',
          muted: '#6b7280', text: '#e5e7eb',
        },
      },
    },
  },
};
