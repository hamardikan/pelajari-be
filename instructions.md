-----

# Instruction Manual: Peningkatan Fitur "Lanjutkan Sesi" (Backend)

**Tujuan Utama:** Meningkatkan *flow experience* pada fitur **Roleplay** dan **Learning** dengan memungkinkan pengguna untuk melanjutkan sesi yang sedang berlangsung (`ongoing session`) secara *seamless*.

**Analisis Konteks:** Berdasarkan kode yang ada, backend sudah memiliki dasar yang kuat untuk melacak status sesi.

  * **Roleplay:** Tabel `roleplaySessions` memiliki kolom `data` dengan status (`active`, `completed`, `abandoned`). Layanan `roleplay.services.ts` sudah memiliki logika untuk memeriksa sesi aktif (`getActiveUserSession`).
  * **Learning:** Tabel `userModuleProgress` melacak status modul (`in_progress`, `completed`) dan `currentSectionIndex`.

Instruksi berikut akan fokus pada penyempurnaan logika yang ada dan menambahkan endpoint API baru untuk mendukung alur "lanjutkan" secara eksplisit.

-----

## Tahap 1: Penyempurnaan Fitur Roleplay

Tujuannya adalah mengubah alur "memulai sesi" agar jika sesi sudah aktif, sistem akan mengembalikan sesi tersebut alih-alih memberikan galat.

### Langkah 1.1: Modifikasi `roleplay.services.ts`

Saat ini, fungsi `startRoleplaySession` memberikan galat jika pengguna sudah memiliki sesi aktif. Ubah perilaku ini untuk mengembalikan sesi yang aktif tersebut.

1.  **Buka file:** `src/roleplay/roleplay.services.ts`.

2.  **Temukan fungsi:** `startRoleplaySession(userId: string, scenarioId: string)`.

3.  **Ubah Logika Pengecekan Sesi Aktif:**

      * Cari blok kode yang memeriksa `activeSession`.
      * Alih-alih melempar `createBusinessLogicError`, ubah blok tersebut untuk mengembalikan data sesi yang sudah ada beserta pesan awalnya.

    **Contoh Perubahan:**

    ```typescript
    // Inside startRoleplaySession function

    // Check if user already has an active session
    const activeSession = await roleplayRepository.getActiveUserSession(userId);
    if (activeSession) {
      logger.info({ userId, sessionId: activeSession.id }, 'User has an ongoing session, returning it.');
      
      // Get the first message of the existing session
      const initialMessage = activeSession.data.sessionData.messages[0]?.content || 'Selamat datang kembali!';

      return {
        sessionId: activeSession.id,
        initialMessage: initialMessage,
        status: 'active',
        isOngoing: true // Tambahkan flag untuk frontend
      };
    }

    // ... (sisa logika untuk membuat sesi baru tetap sama)
    ```

### Langkah 1.2: Buat Endpoint API Baru untuk Mengambil Sesi Aktif

Buat endpoint khusus agar frontend dapat memeriksa status sesi aktif tanpa harus mencoba memulai sesi baru.

1.  **Buka file:** `src/roleplay/roleplay.handlers.ts`.
2.  **Tambahkan Handler Baru:**
    ```typescript
    async function getActiveSession(req: Request, res: Response, next: NextFunction): Promise<void> {
      const correlationId = (req as RequestWithCorrelation).correlationId;
      try {
        const userId = (req as any).user.userId;
        logger.debug({ correlationId, userId }, 'Fetching active roleplay session');
        
        const session = await roleplayService.getActiveSession(userId); // Anda perlu membuat fungsi ini di service
        
        res.json({
          success: true,
          message: 'Active session retrieved successfully',
          data: { session },
          correlationId,
        });
      } catch (error) {
        // ... (error handling)
      }
    }

    // Ekspor handler baru
    // ... addTo exports: getActiveSession: createAsyncErrorWrapper(getActiveSession)
    ```
3.  **Tambahkan Service Baru di `roleplay.services.ts`:**
    ```typescript
    // Tambahkan ini ke dalam interface RoleplayService
    getActiveSession: (userId: string) => Promise<RoleplaySessionRecord | null>;

    // Tambahkan implementasi fungsi di dalam createRoleplayService
    async function getActiveSession(userId: string): Promise<RoleplaySessionRecord | null> {
      try {
        logger.debug({ userId }, 'Fetching active session for user');
        return await roleplayRepository.getActiveUserSession(userId);
      } catch (error) {
        logger.error({ error, userId }, 'Error fetching active session');
        throw error;
      }
    }
    // ... tambahkan getActiveSession ke object yang di-return
    ```
4.  **Tambahkan Route Baru di `src/roleplay/roleplay.routes.ts`:**
    ```typescript
    // Tambahkan route ini sebelum route dinamis lainnya
    router.get(
      '/sessions/active',
      roleplayHandlers.getActiveSession
    );
    ```

-----

## Tahap 2: Penyempurnaan Fitur Learning

Tujuannya adalah memperkaya data progres dan menyediakan endpoint untuk mengambil semua modul yang sedang dikerjakan.

### Langkah 2.1: Perbarui Skema Database untuk Progres

Tambahkan *timestamp* `lastAccessedAt` untuk mengetahui kapan terakhir kali pengguna membuka sebuah modul.

1.  **Buka file:** `src/db/schema.ts`.
2.  **Temukan tipe:** `UserModuleProgressData`.
3.  **Tambahkan field baru** di dalam objek `progress`:
    ```typescript
    export type UserModuleProgressData = {
      // ... (fields lain)
      progress: {
        // ... (fields lain)
        startedAt: string;
        completedAt?: string;
        timeSpent: number;
        lastAccessedAt?: string; // <-- TAMBAHKAN INI
        sectionProgress: Array<{
          // ...
        }>;
      };
    };
    ```

### Langkah 2.2: Perbarui Logika Service dan Repository

Pastikan *timestamp* `lastAccessedAt` diperbarui setiap kali ada interaksi.

1.  **Buka file:** `src/learning/learning.services.ts`.

2.  **Modifikasi `updateProgress`:**

      * Setiap kali fungsi ini dipanggil, perbarui `lastAccessedAt`.

    <!-- end list -->

    ```typescript
    // Di dalam fungsi updateProgress
    const updatedProgressData: Partial<UserModuleProgressData> = {
      progress: {
        ...existingProgress.data.progress,
        lastAccessedAt: new Date().toISOString(), // <-- TAMBAHKAN INI
        // ... (sisa logika)
      },
    };
    ```

3.  **Modifikasi `startModule`:**

      * Saat memulai modul baru atau mengembalikan progres yang sudah ada, set `lastAccessedAt`.

    <!-- end list -->

    ```typescript
    // Di dalam fungsi startModule
    // Jika existingProgress ada:
    // Panggil learningRepository.updateUserProgress untuk memperbarui lastAccessedAt
    if (existingProgress) {
        const updatedData: Partial<UserModuleProgressData> = {
            progress: {
                ...existingProgress.data.progress,
                lastAccessedAt: new Date().toISOString()
            }
        };
        return learningRepository.updateUserProgress(existingProgress.id, updatedData);
    }

    // Jika membuat progress baru:
    const progressData: UserModuleProgressData = {
      // ...
      progress: {
        // ...
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(), // <-- TAMBAHKAN INI
        // ...
      },
    };
    ```

    *Anda mungkin perlu menyesuaikan implementasi `updateUserProgress` di `learning.repositories.ts` untuk mendukung pembaruan parsial pada data JSONB dengan benar.*

### Langkah 2.3: Buat Endpoint untuk Modul "In Progress"

Buat endpoint API khusus untuk mengambil daftar semua modul yang sedang berlangsung, diurutkan berdasarkan yang terakhir diakses.

1.  **Buka file:** `src/learning/learning.handlers.ts`.

2.  **Tambahkan Handler Baru:**

    ```typescript
    async function getOngoingModules(req: Request, res: Response, next: NextFunction): Promise<void> {
        const correlationId = (req as RequestWithCorrelation).correlationId;
        try {
            const userId = (req as any).user.userId;
            const progressList = await learningService.getOngoingModules(userId);
            res.json({
                success: true,
                message: 'Ongoing modules retrieved successfully',
                data: { progressList, count: progressList.length },
                correlationId,
            });
        } catch (error) {
            // ... (error handling)
        }
    }
    // ... ekspor handler baru
    ```

3.  **Tambahkan Service Baru di `src/learning/learning.services.ts`:**

    ```typescript
    // Tambahkan ini ke interface LearningService
    getOngoingModules: (userId: string) => Promise<UserProgressRecord[]>;

    // Implementasi di createLearningService
    async function getOngoingModules(userId: string): Promise<UserProgressRecord[]> {
        return learningRepository.getUserProgressList(userId, { status: 'in_progress' });
    }
    // ... tambahkan ke object yang di-return
    ```

4.  **Perbarui `learning.repositories.ts`:**

      * Pastikan `getUserProgressList` dapat mengurutkan hasilnya berdasarkan `lastAccessedAt`.

    <!-- end list -->

    ```typescript
    // Di dalam getUserProgressList
    // ...
    const result = await db
      .select()
      .from(userModuleProgress)
      .where(and(...whereConditions))
      .orderBy(sql`${userModuleProgress.data}->'progress'->>'lastAccessedAt' DESC NULLS LAST`); // <-- UBAH ORDER BY
    // ...
    ```

5.  **Tambahkan Route Baru di `src/learning/learning.routes.ts`:**

    ```typescript
    router.get(
      '/progress/ongoing',
      learningHandlers.getOngoingModules
    );
    ```

-----

**Instruksi Selesai.** Setelah menerapkan perubahan ini, backend akan sepenuhnya siap untuk mendukung alur "lanjutkan sesi" yang lebih baik untuk kedua fitur.