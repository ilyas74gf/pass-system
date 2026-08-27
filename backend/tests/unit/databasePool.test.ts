import { checkDbHealth, dbPool } from '../../src/config/db';

describe('Database Connection Pool Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Testler tamamlandıktan sonra açık kalan veritabanı havuzunu güvenle kapatıyoruz
    try {
      if (dbPool && typeof dbPool.end === 'function') {
        await dbPool.end();
      }
    } catch (_err) {
      // Test ortamında kapatma hatalarını yut
    }
  });

  test('Veritabanı Health Check bağlantısı başarılı sonuç dönmelidir', async () => {
    // dbPool.query metodunu başarılı durum için taklit (mock) ediyoruz
    jest.spyOn(dbPool, 'query').mockImplementationOnce(() =>
      Promise.resolve({
        rows: [{ status: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as any)
    );

    const isHealthy = await checkDbHealth();
    expect(isHealthy).toBe(true);
  });

  test('Veritabanı sorgu hatası verdiğinde Health Check false dönmelidir', async () => {
    // dbPool.query metodunu hata verecek şekilde taklit ediyoruz
    jest.spyOn(dbPool, 'query').mockImplementationOnce(() =>
      Promise.reject(new Error('DB Connection Failure'))
    );

    const isHealthy = await checkDbHealth();
    expect(isHealthy).toBe(false);
  });

  test('Havuz maksimum bağlantı sınırını (max: 20) aşmamalıdır', () => {
    expect(dbPool.options.max).toEqual(20);
  });
});