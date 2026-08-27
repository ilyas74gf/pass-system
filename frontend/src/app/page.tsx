import { redirect } from 'next/navigation';

export default function HomePage() {
  // Kullanıcı kök dizine (/) girdiğinde doğrudan /login sayfasına aktarılır
  redirect('/login');
}