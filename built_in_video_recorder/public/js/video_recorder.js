$(document).ready(function() {
    let recorder;
    let stream;
    let recordingTimeInterval;
    let startTime;
    let currentFieldName; // Variable to store the field name
    let currentFacingMode = 'environment'; // Default to back camera

    // Include RecordRTC library
    const recordrtcScript = document.createElement('script');
    recordrtcScript.src = 'https://cdn.webrtc-experiment.com/RecordRTC.js';
    document.head.appendChild(recordrtcScript);

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
                                <button id="switchCamera" class="button switch">🔄 Switch Camera</button>
                                <button id="startRecording" class="button start">🔴 Start Recording</button>
                                <button id="stopRecording" class="button stop" disabled>⏹️ Stop Recording</button>
                                <button id="recordAgain" class="button record-again" style="display: none;">🔄 Record Again</button>
                            </div>
                            <a id="downloadLink" class="download-link" style="display: none;">⬇️ Download Video</a>
                            <div id="recordingTime" class="recording-time">00:00</div>
                            <div id="videoDuration" class="video-duration" style="display: none;">Duration: 00:00</div>
                            <div id="cameraModeLabel" class="camera-mode-label">Back Camera</div>
                            <div id="loadingScreen" class="loading-screen" style="display: none;">Processing, please wait...</div>
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
        const switchCameraButton = document.getElementById("switchCamera");
        const downloadLink = document.getElementById("downloadLink");
        const attachVideoButton = document.getElementById("attachVideo");
        const recordingTime = document.getElementById("recordingTime");
        const videoDuration = document.getElementById("videoDuration");
        const cameraModeLabel = document.getElementById("cameraModeLabel");
        const loadingScreen = document.getElementById("loadingScreen");

        async function initializeCamera(facingMode = 'environment') {
            try {
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: facingMode },
                    audio: true
                });
                videoPreview.srcObject = stream;
                videoPreview.muted = true;
                videoPreview.play();

                // Update the camera mode label
                cameraModeLabel.textContent = facingMode === 'user' ? 'Front Camera' : 'Back Camera';
            } catch (error) {
                console.error("Error accessing media devices.", error);
                alert('Could not access camera and microphone. Please check your permissions.');
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
                recorder = RecordRTC(stream, {
                    type: 'video',
                    mimeType: 'video/webm', // Record in WebM format
                    videoBitsPerSecond: 0.25 * 1000 * 1000 // set bitrate to 0.25 Mbps
                });
                recorder.startRecording();
                startTime = Date.now();
                recordingTime.textContent = "00:00";
                recordingTimeInterval = setInterval(updateRecordingTime, 1000);
                startRecordingButton.disabled = true;
                stopRecordingButton.disabled = false;
                recordAgainButton.style.display = "none";
            } catch (error) {
                console.error("Error starting recording:", error);
                alert('Could not start recording. Please try again.');
            }
        }

        async function stopRecording() {
            try {
                clearInterval(recordingTimeInterval); // Stop the timer
                stopRecordingButton.disabled = true;
                loadingScreen.style.display = "block"; // Show loading screen

                recorder.stopRecording(async () => {
                    const videoBlob = recorder.getBlob();
                    const compressedBlob = await sendVideoToBackend(videoBlob);
                    const videoURL = URL.createObjectURL(compressedBlob);
                    downloadLink.href = videoURL;
                    downloadLink.style.display = "block";
                    downloadLink.download = "recorded-video.mp4";

                    attachVideoButton.disabled = false;

                    // Set the preview video source and play it
                    videoPreview.srcObject = null;
                    videoPreview.src = videoURL;
                    videoPreview.controls = true;
                    videoPreview.play();

                    const videoElement = document.createElement('video');
                    videoElement.src = videoURL;
                    videoElement.addEventListener('loadedmetadata', () => {
                        const duration = videoElement.duration;
                        const minutes = String(Math.floor(duration / 60)).padStart(2, '0');
                        const seconds = String(Math.floor(duration % 60)).padStart(2, '0');
                        videoDuration.textContent = `Duration: ${minutes}:${seconds}`;
                        videoDuration.style.display = "block";
                    });

                    attachVideoButton.onclick = async function() {
                        try {
                            loadingScreen.textContent = "Attaching video, please wait...";
                            loadingScreen.style.display = "block";

                            // Simulate delay for attachment process
                            setTimeout(async () => {
                                const fileURL = await uploadBlobToServer(compressedBlob, "recorded_video.mp4");

                                const doc = cur_frm.doc;
                                doc[currentFieldName] = fileURL; // Use the captured field name here

                                await frappe.call({
                                    method: "frappe.desk.form.save.savedocs",
                                    args: {
                                        doc: doc,
                                        action: "Save"
                                    },
                                    callback: function(r) {
                                        if (!r.exc) {
                                            frappe.show_alert({ message: 'Document updated with video attachment', indicator: 'green' });
                                            cur_frm.reload_doc();
                                        }
                                    }
                                });

                                $('#videoRecorderModal').modal('hide');
                                $('#videoRecorderModal').remove();
                                stream.getTracks().forEach(track => track.stop());

                                $('.modal-backdrop').remove();

                                if (window.parent) {
                                    window.parent.$('.modal').modal('hide');
                                }

                                loadingScreen.style.display = "none"; // Hide loading screen
                            }, 3000); // Simulate a 3-second delay
                        } catch (error) {
                            console.error("Error attaching video:", error);
                            frappe.show_alert({ message: 'Video attachment failed', indicator: 'red' });
                        }
                    };

                    // Show the "Record Again" button and hide the "Start Recording" button
                    recordAgainButton.style.display = "block";
                    startRecordingButton.style.display = "none";

                    loadingScreen.style.display = "none"; // Hide loading screen
                });
            } catch (error) {
                console.error("Error stopping recording:", error);
                alert('Could not stop recording. Please try again.');
            }
        }

        async function recordAgain() {
            videoPreview.srcObject = stream;
            videoPreview.controls = false;
            videoPreview.play();
            recordingTime.textContent = "00:00";
            videoDuration.style.display = "none";
            downloadLink.style.display = "none";
            attachVideoButton.disabled = true;
            startRecordingButton.style.display = "block";
            startRecordingButton.disabled = false;
            stopRecordingButton.disabled = true;
            recordAgainButton.style.display = "none";
        }

        async function switchCamera() {
            currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
            await initializeCamera(currentFacingMode);
        }

        $('#videoRecorderModal').on('shown.bs.modal', function() {
            initializeCamera(currentFacingMode);
        });

        startRecordingButton.addEventListener("click", startRecording);
        stopRecordingButton.addEventListener("click", stopRecording);
        recordAgainButton.addEventListener("click", recordAgain);
        switchCameraButton.addEventListener("click", switchCamera);

        $('#videoRecorderModal').modal('show');
    }

    function addVideoButton() {
        $('.btn-file-upload').each(function() {
            if (!$(this).siblings('.btn-video-upload').length) {
                let video_btn = $('<button class="btn btn-video-upload"><i class="fa fa-video-camera"></i><span>Record Video</span></button>');
                $(this).after(video_btn);

                video_btn.on('click', function() {
                    openCameraModal();
                });
            }
        });
    }

    async function sendVideoToBackend(videoBlob) {
        const formData = new FormData();
        formData.append('file', videoBlob, 'video.webm');

        let csrf_token = frappe.csrf_token;

        try {
            const response = await fetch('/api/method/built_in_video_recorder.api.video_compressor.compress_video', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Frappe-CSRF-Token': csrf_token
                }
            });

            if (!response.ok) {
                throw new Error('Failed to compress video: ' + await response.text());
            }

            const compressedBlob = await response.blob();
            return compressedBlob;

        } catch (error) {
            console.error("Error compressing video:", error);
            throw error;
        }
    }

    async function uploadBlobToServer(blob, filename) {
        const formData = new FormData();
        formData.append('file', blob, filename);

        let csrf_token = frappe.csrf_token;

        try {
            const response = await fetch('/api/method/upload_file', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Frappe-CSRF-Token': csrf_token
                }
            });

            if (!response.ok) {
                throw new Error('Failed to upload video: ' + await response.text());
            }

            const result = await response.json();
            return result.message.file_url;
        } catch (error) {
            console.error("Error uploading video:", error);
            throw error;
        }
    }

    addVideoButton();

    $(document).on('DOMNodeInserted', function(e) {
        if ($(e.target).hasClass('btn-file-upload') || $(e.target).find('.btn-file-upload').length) {
            addVideoButton();
        }
    });

    // Event listener for attach buttons
    $(document).on('click', '.btn-attach', function() {
        currentFieldName = $(this).data('fieldname'); // Call openCameraModal here
    });
});

