document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewSection = document.getElementById('previewSection');
    const originalPreview = document.getElementById('originalPreview');
    const compressedPreview = document.getElementById('compressedPreview');
    const originalSize = document.getElementById('originalSize');
    const compressedSize = document.getElementById('compressedSize');
    const qualitySlider = document.getElementById('quality');
    const qualityValue = document.getElementById('qualityValue');
    const downloadBtn = document.getElementById('downloadBtn');
    const warningMessage = document.querySelector('.quality-warning-message');

    let originalFile = null;

    // 点击上传区域触发文件选择
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // 处理拖拽上传
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#007AFF';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#DEDEDE';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#DEDEDE';
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // 处理文件选择
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // 处理质量滑块变化
    qualitySlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        qualityValue.textContent = `${value}%`;
        
        // 当值低于警告标记时显示警告信息
        if (value < 40) {
            warningMessage.style.opacity = '1';
        } else {
            warningMessage.style.opacity = '0';
        }
        
        if (originalFile) {
            compressImage(originalFile, value / 100);
        }
    });

    // 添加滑块悬停提示
    const warningMark = document.querySelector('.quality-warning-mark');
    warningMark.addEventListener('mouseenter', () => {
        warningMark.title = '低于40%的压缩质量可能导致图片失真或尺寸过小';
    });

    // 处理文件
    function handleFile(file) {
        if (!file.type.match(/image\/(jpeg|png)/)) {
            alert('请上传 PNG 或 JPG 格式的图片！');
            return;
        }

        originalFile = file;
        previewSection.style.display = 'block';
        
        // 显示原图大小
        originalSize.textContent = formatFileSize(file.size);

        // 预览原图
        const reader = new FileReader();
        reader.onload = (e) => {
            originalPreview.src = e.target.result;
            compressImage(file, qualitySlider.value / 100);
        };
        reader.readAsDataURL(file);
    }

    // 压缩图片
    function compressImage(file, quality) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                
                // 初始尺寸计算
                let width = img.width;
                let height = img.height;
                
                // 设置目标大小范围（原图的10%-80%）
                const minTargetSize = file.size * 0.1;
                const maxTargetSize = file.size * 0.8;
                // 根据质量滑块计算目标大小（使用指数关系使低质量时压缩更激进）
                const targetSize = minTargetSize + (maxTargetSize - minTargetSize) * Math.pow(quality, 2);
                
                // 计算初始缩放比例（更激进的初始缩放）
                const initialScale = Math.min(1, Math.pow(targetSize / file.size, 0.7));
                width = Math.round(width * initialScale);
                height = Math.round(height * initialScale);

                // 限制最大尺寸
                const maxSize = 2048;
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    } else {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                // 应用质量参数的缩放（更激进的缩放）
                const qualityScale = 0.4 + (quality * 0.6);
                width = Math.round(width * qualityScale);
                height = Math.round(height * qualityScale);

                // 降低最小尺寸限制
                const minSize = 100;
                width = Math.max(width, minSize);
                height = Math.max(height, minSize);

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // 绘制图片
                ctx.drawImage(img, 0, 0, width, height);

                const mimeType = file.type;
                // 更激进的初始质量
                let compressionQuality = Math.pow(quality, 1.5);

                // PNG图片压缩策略
                if (mimeType === 'image/png') {
                    compressionQuality = Math.min(quality, 0.5);
                }

                let attempts = 0;
                const MAX_ATTEMPTS = 8;  // 增加尝试次数

                function tryCompress(currentQuality) {
                    if (attempts >= MAX_ATTEMPTS) {
                        // 最后一次尝试，使用极低的质量
                        canvas.toBlob(
                            (blob) => updatePreviewAndDownload(blob, file.name, mimeType),
                            mimeType,
                            0.1
                        );
                        return;
                    }
                    attempts++;

                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                console.error('压缩失败');
                                return;
                            }

                            // 检查是否在目标范围内
                            if (blob.size > maxTargetSize) {
                                // 文件太大，继续压缩（更激进的压缩）
                                width = Math.round(width * 0.7);
                                height = Math.round(height * 0.7);
                                width = Math.max(width, minSize);
                                height = Math.max(height, minSize);
                                
                                canvas.width = width;
                                canvas.height = height;
                                ctx.drawImage(img, 0, 0, width, height);
                                
                                const newQuality = currentQuality * 0.6;  // 更激进的质量降低
                                tryCompress(Math.max(newQuality, 0.1));  // 允许更低的质量
                                return;
                            } else if (blob.size < minTargetSize && width < img.width) {
                                // 文件太小，适当增加质量
                                const newQuality = Math.min(currentQuality * 1.2, 0.8);
                                tryCompress(newQuality);
                                return;
                            }

                            updatePreviewAndDownload(blob, file.name, mimeType);
                        },
                        mimeType,
                        currentQuality
                    );
                }

                // 开始压缩
                tryCompress(compressionQuality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // 更新预览和下载按钮
    function updatePreviewAndDownload(blob, fileName, mimeType) {
        const blobUrl = URL.createObjectURL(blob);
        compressedPreview.src = blobUrl;
        compressedSize.textContent = formatFileSize(blob.size);

        downloadBtn.onclick = () => {
            const link = document.createElement('a');
            const extension = mimeType.split('/')[1];
            link.href = blobUrl;
            link.download = `compressed_${fileName.replace(/\.[^/.]+$/, '')}.${extension}`;
            link.click();
        };
    }

    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}); 