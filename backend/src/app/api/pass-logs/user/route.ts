import { NextResponse } from 'next/server';
// Kendi prisma/db bağlantı dosyanızın yolu
import prisma from '../../../../config/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Kullanıcı ID (userId) parametresi gereklidir.' },
        { status: 400 }
      );
    }

    // Gerçek Veritabanı Sorgusu
    const userLogs = await prisma.passLog.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });

    // Veritabanı boşsa userLogs otomatik [] (boş dizi) döner
    return NextResponse.json({
      status: 'SUCCESS',
      logs: userLogs,
    });
  } catch (error) {
    console.error('Kullanıcı logları getirme hatası:', error);
    return NextResponse.json(
      { error: 'Geçmiş kayıtlar alınamadı.' },
      { status: 500 }
    );
  }
}