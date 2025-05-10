$(document).ready(function () {
    console.log('Video recorder initialized...');
    let mediaRecorder;
    let recordedChunks = [];
    let stream;
    let recordingTimeInterval;
    let startTime;
    let currentFieldName;

    async function openCameraModal() {
        $('#videoRecorderModal').remove();

        const modalHtml = `
        <div id="videoRecorderModal" class="modal fade" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Record Video</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="video-container">
                            <video id="videoPreview" autoplay muted></video>
                            <div class="controls">
                                <button id="startRecording" class="button start">🔴 Start Recording</button>
                                <button id="stopRecording" class="button stop" disabled>⏹️ Stop Recording</button>
                                <button id="recordAgain" class="button record-again" style="display: none;">🔄 Record Again</button>
                            </div>
                            <a id="downloadLink" class="download-link" style="display: none;">⬇️ Download Video</a>
                            <div id="recordingTime" class="recording-time">00:00</div>
                            <div id="videoDuration" class="video-duration" style="display: none;">Duration: 00:00</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                        <button id="attachVideo" class="btn btn-success" disabled>Attach Video</button>
                    </div>
                </div>
            </div>
        </div>
        `;
        $('body').append(modalHtml);

        const videoPreview = document.getElementById("videoPreview");
        const startRecordingButton = document.getElementById("startRecording");
        const stopRecordingButton = document.getElementById("stopRecording");
        const recordAgainButton = document.getElementById("recordAgain");
        const downloadLink = document.getElementById("downloadLink");
        const attachVideoButton = document.getElementById("attachVideo");
        const recordingTime = document.getElementById("recordingTime");
        const videoDuration = document.getElementById("videoDuration");

        async function initializeCamera() {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                videoPreview.srcObject = stream;
                videoPreview.play();
            } catch (error) {
                frappe.msgprint(__('Could not access camera and microphone. Please check permissions.'));
            }
        }

        function updateRecordingTime() {
            const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
            const minutes = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
            const seconds = String(elapsedTime % 60).padStart(2, '0');
            recordingTime.textContent = `${minutes}:${seconds}`;
        }

        async function startRecording() {
            try {
                recordedChunks = [];
                mediaRecorder = new MediaRecorder(stream);

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) recordedChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    const videoBlob = new Blob(recordedChunks, { type: "video/webm" });
                    const videoURL = URL.createObjectURL(videoBlob);

                    downloadLink.href = videoURL;
                    downloadLink.style.display = "block";
                    downloadLink.download = "recorded-video.webm";

                    attachVideoButton.disabled = false;
                    videoPreview.srcObject = null;
                    videoPreview.src = videoURL;
                    videoPreview.controls = true;
                    videoPreview.play();
                    const videoElement = document.createElement('video');
                    videoElement.src = videoURL;
                    
                    videoElement.addEventListener('loadeddata', () => {
                        const waitForDuration = setInterval(() => {
                            const duration = videoElement.duration;
                    
                            if (!isNaN(duration) && isFinite(duration)) {
                                clearInterval(waitForDuration);
                                const minutes = String(Math.floor(duration / 60)).padStart(2, '0');
                                const seconds = String(Math.floor(duration % 60)).padStart(2, '0');
                                videoDuration.textContent = `Duration: ${minutes}:${seconds}`;
                                videoDuration.style.display = "block";
                            }
                        }, 200); // checks every 200ms
                    });
                    
                    
                    attachVideoButton.onclick = async function () {
                        if (!currentFieldName) {
                            frappe.msgprint(__('Field name not set. Please click the paperclip icon first.'));
                            return;
                        }

                        let file = new File([videoBlob], "recorded_video.webm", { type: 'video/webm' });
                        let formData = new FormData();
                        formData.append('file', file);
                        formData.append('is_private', 1);
                        formData.append('folder', 'Home');
                        formData.append('doctype', cur_frm.doctype);
                        formData.append('docname', cur_frm.docname);
                        formData.append('fieldname', currentFieldName);

                        attachVideoButton.disabled = true;
                        attachVideoButton.textContent = "Uploading...";

                        let site_url = frappe.urllib.get_base_url();

                        console.log(site_url)

                        try {
                            let response = await fetch(`${site_url}/api/method/upload_file`, {
                                method: 'POST',
                                body: formData,
                                headers: {
                                    'X-Frappe-CSRF-Token': frappe.csrf_token
                                }
                            });

                            if (response.ok) {
                                let result = await response.json();
                                cur_frm.set_value(currentFieldName, result.message.file_url);
                                cur_frm.refresh_field(currentFieldName);
                                frappe.show_alert({ message: 'Video attached successfully. Please save the form manually.', indicator: 'green' });
                                $('.modal-dialog').hide()
                                $('.modal-backdrop').hide()

                                $('#videoRecorderModal').modal('hide');
                                stream.getTracks().forEach(track => track.stop());
                                $('.modal-backdrop').remove();

                            } else {
                                throw new Error('Upload failed');
                            }
                        } catch (error) {
                            console.error("Error uploading:", error);
                            frappe.show_alert({ message: 'Upload failed', indicator: 'red' });
                        }
                    };

                    recordAgainButton.style.display = "block";
                    startRecordingButton.style.display = "none";
                };

                mediaRecorder.start();
                startTime = Date.now();
                recordingTime.textContent = "00:00";
                recordingTimeInterval = setInterval(updateRecordingTime, 1000);
                startRecordingButton.disabled = true;
                stopRecordingButton.disabled = false;
                recordAgainButton.style.display = "none";
            } catch (error) {
                frappe.msgprint(__('Could not start recording.'));
            }
        }

        function stopRecording() {
            if (mediaRecorder && mediaRecorder.state === "recording") {
                mediaRecorder.stop();
                clearInterval(recordingTimeInterval);
                recordingTime.textContent = "00:00";
                stopRecordingButton.disabled = true;
            }
        }

        function recordAgain() {
            videoPreview.srcObject = stream;
            videoPreview.controls = false;
            videoPreview.play();
            recordingTime.textContent = "00:00";
            videoDuration.style.display = "none";
            downloadLink.style.display = "none";
            attachVideoButton.disabled = true;
            attachVideoButton.textContent = "Attach Video";
            startRecordingButton.style.display = "block";
            startRecordingButton.disabled = false;
            stopRecordingButton.disabled = true;
            recordAgainButton.style.display = "none";
        }

        $('#videoRecorderModal').on('shown.bs.modal', initializeCamera);
        $('#videoRecorderModal').on('hidden.bs.modal', () => {
            if (stream) stream.getTracks().forEach(track => track.stop());
            clearInterval(recordingTimeInterval);
            $('#videoRecorderModal').remove();
            $('.modal-backdrop').remove();
        });

        startRecordingButton.addEventListener("click", startRecording);
        stopRecordingButton.addEventListener("click", stopRecording);
        recordAgainButton.addEventListener("click", recordAgain);

        $('#videoRecorderModal').modal('show');
    }

    function addVideoButton() {
        $('.btn-file-upload').each(function () {
            if (!$(this).siblings('.btn-video-upload').length) {
                let video_btn = $('<button class="btn btn-video-upload"><i class="fa fa-video-camera"></i><span> Record Video</span></button>');
                $(this).after(video_btn);

                video_btn.on('click', function () {
                    if (!currentFieldName) {
                        frappe.msgprint(__('Please click the paperclip icon first to choose the field.'));
                        return;
                    }
                    console.log("Opening recorder for field:", currentFieldName);
                    openCameraModal();
                });
            }
        });
    }

    // Initial button load
    addVideoButton();

    // Watch for new upload fields added dynamically
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (
                        node.nodeType === 1 && (
                            node.classList.contains('btn-file-upload') ||
                            node.querySelector('.btn-file-upload')
                        )
                    ) {
                        addVideoButton();
                    }
                });
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Capture fieldname from paperclip (attach) buttons
    $(document).on('click', '.btn-attach', function () {
        currentFieldName = $(this).data('fieldname');
        console.log("Attach clicked, currentFieldName set to:", currentFieldName);
    });
});
