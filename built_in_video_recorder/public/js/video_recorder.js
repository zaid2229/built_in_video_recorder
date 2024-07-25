$(document).ready(function() {
    let mediaRecorder;
    let recordedChunks = [];
    let stream;
    let recordingTimeInterval;
    let startTime;
    let currentFieldName; // Variable to store the field name

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
                videoPreview.muted = true;
                videoPreview.play();
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
                recordedChunks = [];
                mediaRecorder = new MediaRecorder(stream);

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        recordedChunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    const videoBlob = new Blob(recordedChunks, { type: "video/webm" });
                    recordedChunks = [];

                    const videoURL = URL.createObjectURL(videoBlob);
                    downloadLink.href = videoURL;
                    downloadLink.style.display = "block";
                    downloadLink.download = "recorded-video.webm";

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
                        let file = new File([videoBlob], "recorded_video.webm", { type: 'video/webm' });

                        let formData = new FormData();
                        formData.append('file', file);
                        formData.append('is_private', 1);
                        formData.append('doctype', cur_frm.doctype);
                        formData.append('docname', cur_frm.docname);

                        let csrf_token = frappe.csrf_token;

                        try {
                            let response = await fetch('/api/method/upload_file', {
                                method: 'POST',
                                body: formData,
                                headers: {
                                    'X-Frappe-CSRF-Token': csrf_token
                                }
                            });

                            if (response.ok) {
                                let result = await response.json();
                                frappe.show_alert({message: 'Video uploaded successfully', indicator: 'green'});

                                const doc = cur_frm.doc;
                                doc[currentFieldName] = result.message.file_url; // Use the captured field name here

                                await frappe.call({
                                    method: "frappe.desk.form.save.savedocs",
                                    args: {
                                        doc: doc,
                                        action: "Save"
                                    },
                                    callback: function(r) {
                                        if (!r.exc) {
                                            frappe.show_alert({message: 'Document updated with video attachment', indicator: 'green'});
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
                            } else {
                                throw new Error('Failed to upload video');
                            }
                        } catch (error) {
                            console.error("Error uploading video:", error);
                            frappe.show_alert({message: 'Video upload failed', indicator: 'red'});
                        }
                    };

                    // Show the "Record Again" button and hide the "Start Recording" button
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
                console.error("Error starting recording:", error);
                alert('Could not start recording. Please try again.');
            }
        }

        function stopRecording() {
            if (mediaRecorder && mediaRecorder.state === "recording") {
                mediaRecorder.stop();
                startRecordingButton.disabled = true;
                stopRecordingButton.disabled = true;
                clearInterval(recordingTimeInterval);
                recordingTime.textContent = "00:00";
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

        $('#videoRecorderModal').on('shown.bs.modal', initializeCamera);
        startRecordingButton.addEventListener("click", startRecording);
        stopRecordingButton.addEventListener("click", stopRecording);
        recordAgainButton.addEventListener("click", recordAgain);

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

    addVideoButton();

    $(document).on('DOMNodeInserted', function(e) {
        if ($(e.target).hasClass('btn-file-upload') || $(e.target).find('.btn-file-upload').length) {
            addVideoButton();
        }
    });

    // Event listener for attach buttons
    $(document).on('click', '.btn-attach', function() {
        currentFieldName = $(this).data('fieldname'); // Capture the field name
    });
});
