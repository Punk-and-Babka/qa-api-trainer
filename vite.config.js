import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Явный IPv4. По умолчанию Vite слушает "localhost", а Node с версии 17
    // отдаёт адреса в том порядке, в каком их вернула ОС, — на этой машине
    // первым идёт ::1. VPN-клиент с TUN-адаптером перехватывает IPv6-маршрут,
    // и петля ::1 не отвечает: сервер поднимается, но недостижим.
    host: '127.0.0.1',
    port: 5173,
    open: true,
  },
});
