# Загрузка проекта на GitHub и получение APK

## Способ 1. Через GitHub Desktop (без командной строки)

1. Распакуйте ZIP: внутри находится папка `Gortenziya_Moy_Sad_GitHub`.
2. В GitHub Desktop выберите **File → Add local repository → Choose…** и укажите распакованную папку.
3. Если программа предлагает создать репозиторий, согласитесь (**create a repository here**).
4. Сделайте первый коммит (Summary: `Initial Android app`) и нажмите **Publish repository**.
5. Откройте репозиторий на GitHub, перейдите в **Actions → Android APK → Run workflow**. На первое открытие GitHub может потребовать разрешить Actions для репозитория.
6. После завершения задания откройте его запуск и раздел **Artifacts**, скачайте `Gortenziya-Moy-Sad-debug-APK`.
7. Распакуйте скачанный архив: внутри `app-debug.apk`, который можно установить на Android-устройство в рамках стандартных настроек устройства.

При загрузке через веб-интерфейс GitHub нужно добавить **распакованные файлы с сохранением папок**, а не ZIP целиком. Файл `.github/workflows/build-android.yml` должен попасть в репозиторий: именно он запускает сборку.

## Способ 2. Через Git (Windows PowerShell или терминал)

Создайте **пустой** репозиторий на GitHub (без README и .gitignore), затем из распакованной папки выполните:

```bash
git init -b main
git add .
git commit -m "Initial Android app"
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

Замените `USERNAME/REPOSITORY` адресом **своего** репозитория. Для отправки понадобится авторизация GitHub. После отправки workflow автоматически запустится; его можно также запустить вручную в Actions.

## Где найти APK

`GitHub → ваш репозиторий → Actions → Android APK → успешный запуск → Artifacts → Gortenziya-Moy-Sad-debug-APK`.

`app-debug.apk` — тестовая (debug) сборка, подписанная стандартным отладочным ключом GitHub Actions. Она подходит для проверки на устройстве. Для публикации в Google Play понадобится отдельная релизная сборка с **вашим** ключом подписи; не храните ключи или пароли в репозитории.

## Что делать, если сборка не прошла

Откройте соответствующий запуск в Actions → `Test and build debug APK` и разверните красный шаг. Частые причины: недоступность сервисов загрузки Gradle/Android SDK, ограничения GitHub Actions для репозитория или реальная ошибка компиляции. Репозиторий содержит исходники и сценарий CI; до первой успешной сборки на GitHub наличие готового APK не гарантируется.
