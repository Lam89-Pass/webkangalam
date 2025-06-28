<?php
ini_set('display_errors', 0);
error_reporting(0);

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

function send_json_response($success, $message, $data = [], $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode(['success' => $success, 'message' => $message, 'data' => $data]);
    exit();
}

set_error_handler(function ($severity, $message, $file, $line) {
    send_json_response(false, "Server Error: Terjadi masalah internal pada server.", [], 500);
});

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit();
}

define('DATA_FILE', 'data.json');
define('UPLOAD_DIR', 'uploads/');
define('ADMIN_PASSWORD', 'admin123');
define('MAX_FILE_SIZE', 10 * 1024 * 1024);
define('ALLOWED_MIME_TYPES', ['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

if (!is_dir(UPLOAD_DIR)) {
    if (!mkdir(UPLOAD_DIR, 0755, true)) {
        send_json_response(false, 'Error Konfigurasi: Gagal membuat direktori ' . UPLOAD_DIR, [], 500);
    }
}
if (!is_writable(UPLOAD_DIR)) {
    send_json_response(false, 'Error Konfigurasi: Direktori ' . UPLOAD_DIR . ' tidak dapat ditulisi.', [], 500);
}
if (file_exists(DATA_FILE) && !is_writable(DATA_FILE)) {
    send_json_response(false, 'Error Konfigurasi: File ' . DATA_FILE . ' tidak dapat ditulisi.', [], 500);
}

function get_items_data()
{
    if (!file_exists(DATA_FILE)) return [];
    $items = json_decode(file_get_contents(DATA_FILE), true);
    return is_array($items) ? $items : [];
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get_items':
        echo json_encode(get_items_data());
        break;

    case 'add_item':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_json_response(false, 'Metode harus POST', null, 405);
        if (($_POST['admin_password'] ?? '') !== ADMIN_PASSWORD) send_json_response(false, 'Kata sandi admin salah.', null, 403);

        $title = trim($_POST['title'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $category = htmlspecialchars(html_entity_decode(trim($_POST['category'] ?? '')), ENT_QUOTES, 'UTF-8');

        if (empty($title) || empty($description) || empty($category)) send_json_response(false, 'Judul, deskripsi, dan kategori wajib diisi.', null, 400);
        if (!isset($_FILES['images']) || !is_array($_FILES['images']['name']) || empty(array_filter($_FILES['images']['name']))) send_json_response(false, 'Anda harus mengunggah setidaknya satu gambar.', null, 400);

        $imageUrls = [];
        for ($i = 0; $i < count($_FILES['images']['name']); $i++) {
            if ($_FILES['images']['error'][$i] !== UPLOAD_ERR_OK) continue;
            $tmpFilePath = $_FILES['images']['tmp_name'][$i];
            $originalFileName = $_FILES['images']['name'][$i];
            $fileSize = $_FILES['images']['size'][$i];
            $fileMimeType = mime_content_type($tmpFilePath);

            if ($fileSize > MAX_FILE_SIZE) send_json_response(false, "File '{$originalFileName}' terlalu besar (maks 5MB).", null, 400);
            if (!in_array($fileMimeType, ALLOWED_MIME_TYPES)) send_json_response(false, "Jenis file '{$originalFileName}' tidak diizinkan.", null, 400);

            $extension = strtolower(pathinfo($originalFileName, PATHINFO_EXTENSION));
            $newFileName = uniqid('img_', true) . '.' . $extension;
            $destinationPath = UPLOAD_DIR . $newFileName;

            if (move_uploaded_file($tmpFilePath, $destinationPath)) {
                $imageUrls[] = $destinationPath;
            }
        }

        if (empty($imageUrls)) send_json_response(false, 'Gagal memproses semua gambar yang diunggah.', null, 500);

        $items = get_items_data();
        $newItem = ['id' => uniqid(), 'title' => htmlspecialchars($title), 'description' => htmlspecialchars($description), 'category' => $category, 'imageUrls' => $imageUrls, 'timestamp' => time()];
        array_unshift($items, $newItem);

        if (file_put_contents(DATA_FILE, json_encode($items, JSON_PRETTY_PRINT))) {
            send_json_response(true, 'Item berhasil ditambahkan.', $newItem, 201);
        } else {
            foreach ($imageUrls as $url) {
                if (file_exists($url)) unlink($url);
            }
            send_json_response(false, 'Gagal menulis ke file data.', null, 500);
        }
        break;

    case 'update_item':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_json_response(false, 'Metode harus POST.', null, 405);
        if (($_POST['admin_password'] ?? '') !== ADMIN_PASSWORD) send_json_response(false, 'Kata sandi admin salah.', null, 403);

        $itemId = trim($_POST['item_id'] ?? '');
        $title = trim($_POST['title'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $category = htmlspecialchars(html_entity_decode(trim($_POST['category'] ?? '')), ENT_QUOTES, 'UTF-8');

        if (empty($itemId) || empty($title) || empty($description) || empty($category)) {
            send_json_response(false, 'ID, Judul, deskripsi, dan kategori wajib diisi.', null, 400);
        }

        $items = get_items_data();
        $itemIndex = -1;
        $itemToUpdate = null;

        foreach ($items as $index => $item) {
            if ($item['id'] === $itemId) {
                $itemIndex = $index;
                $itemToUpdate = $item;
                break;
            }
        }

        if ($itemIndex === -1) send_json_response(false, 'Item tidak ditemukan.', null, 404);

        $items[$itemIndex]['title'] = htmlspecialchars($title);
        $items[$itemIndex]['description'] = htmlspecialchars($description);
        $items[$itemIndex]['category'] = $category;

        if (isset($_FILES['images']) && !empty(array_filter($_FILES['images']['name']))) {
            foreach ($itemToUpdate['imageUrls'] as $oldImageUrl) {
                if (file_exists($oldImageUrl)) {
                    unlink($oldImageUrl);
                }
            }

            $newImageUrls = [];
            for ($i = 0; $i < count($_FILES['images']['name']); $i++) {
                if ($_FILES['images']['error'][$i] !== UPLOAD_ERR_OK) continue;
                $tmpFilePath = $_FILES['images']['tmp_name'][$i];
                $originalFileName = $_FILES['images']['name'][$i];
                $fileSize = $_FILES['images']['size'][$i];
                $fileMimeType = mime_content_type($tmpFilePath);

                if ($fileSize > MAX_FILE_SIZE) send_json_response(false, "File '{$originalFileName}' terlalu besar.", null, 400);
                if (!in_array($fileMimeType, ALLOWED_MIME_TYPES)) send_json_response(false, "Jenis file '{$originalFileName}' tidak diizinkan.", null, 400);

                $extension = strtolower(pathinfo($originalFileName, PATHINFO_EXTENSION));
                $newFileName = uniqid('img_', true) . '.' . $extension;
                $destinationPath = UPLOAD_DIR . $newFileName;

                if (move_uploaded_file($tmpFilePath, $destinationPath)) {
                    $newImageUrls[] = $destinationPath;
                }
            }

            if (!empty($newImageUrls)) {
                $items[$itemIndex]['imageUrls'] = $newImageUrls;
            }
        }

        if (file_put_contents(DATA_FILE, json_encode(array_values($items), JSON_PRETTY_PRINT))) {
            send_json_response(true, 'Item berhasil diperbarui.', $items[$itemIndex]);
        } else {
            send_json_response(false, 'Gagal memperbarui file data.', null, 500);
        }
        break;

    case 'delete_item':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_json_response(false, 'Metode harus POST.', null, 405);
        if (($_POST['admin_password'] ?? '') !== ADMIN_PASSWORD) send_json_response(false, 'Kata sandi admin salah.', null, 403);

        $itemId = trim($_POST['item_id'] ?? '');
        if (empty($itemId)) send_json_response(false, 'ID item wajib ada.', null, 400);

        $items = get_items_data();
        $itemToDelete = null;
        $updatedItems = array_filter($items, function ($item) use ($itemId, &$itemToDelete) {
            if ($item['id'] === $itemId) {
                $itemToDelete = $item;
                return false;
            }
            return true;
        });

        if ($itemToDelete === null) send_json_response(false, 'Item tidak ditemukan.', null, 404);

        if (isset($itemToDelete['imageUrls']) && is_array($itemToDelete['imageUrls'])) {
            foreach ($itemToDelete['imageUrls'] as $url) {
                if (file_exists($url)) unlink($url);
            }
        }

        if (file_put_contents(DATA_FILE, json_encode(array_values($updatedItems), JSON_PRETTY_PRINT))) {
            send_json_response(true, 'Item berhasil dihapus.', ['itemId' => $itemId]);
        } else {
            send_json_response(false, 'Gagal memperbarui file data.', null, 500);
        }
        break;

    case 'delete_image':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_json_response(false, 'Metode harus POST.', null, 405);
        if (($_POST['admin_password'] ?? '') !== ADMIN_PASSWORD) send_json_response(false, 'Kata sandi admin salah.', null, 403);

        $itemId = trim($_POST['item_id'] ?? '');
        $imageUrlToDelete = trim($_POST['image_url'] ?? '');
        if (empty($itemId) || empty($imageUrlToDelete)) send_json_response(false, 'ID item dan URL gambar wajib ada.', null, 400);

        $items = get_items_data();
        $itemIndex = -1;
        foreach ($items as $index => $item) {
            if ($item['id'] === $itemId) {
                $itemIndex = $index;
                break;
            }
        }
        if ($itemIndex === -1) send_json_response(false, 'Item tidak ditemukan.', null, 404);

        $imageUrls = $items[$itemIndex]['imageUrls'] ?? [];
        if (count($imageUrls) <= 1) send_json_response(false, 'Tidak bisa menghapus gambar terakhir.', null, 400);

        $updatedImageUrls = array_filter($imageUrls, fn($url) => $url !== $imageUrlToDelete);

        if (count($updatedImageUrls) === count($imageUrls)) send_json_response(false, 'URL gambar tidak ditemukan.', null, 404);

        if (file_exists($imageUrlToDelete)) unlink($imageUrlToDelete);

        $items[$itemIndex]['imageUrls'] = array_values($updatedImageUrls);

        if (file_put_contents(DATA_FILE, json_encode($items, JSON_PRETTY_PRINT))) {
            send_json_response(true, 'Gambar berhasil dihapus.', ['itemId' => $itemId, 'deletedUrl' => $imageUrlToDelete]);
        } else {
            send_json_response(false, 'Gagal memperbarui file data.', null, 500);
        }
        break;

    default:
        send_json_response(false, 'Aksi tidak valid.', null, 404);
        break;
}
