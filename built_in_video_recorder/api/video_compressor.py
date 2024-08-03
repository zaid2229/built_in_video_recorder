import frappe
import os
import subprocess
from werkzeug.utils import secure_filename
from werkzeug.wrappers import Response

@frappe.whitelist(allow_guest=True)
def compress_video():
    try:
        if 'file' not in frappe.request.files:
            return {'error': "No file part"}, 400

        file = frappe.request.files['file']

        if file.filename == '':
            return {'error': "No selected file"}, 400

        filename = secure_filename(file.filename)
        input_path = os.path.join('/tmp', filename)
        output_path = os.path.join('/tmp', 'output.mp4')

        file.save(input_path)

        command = ['ffmpeg', '-y', '-i', input_path, '-c:v', 'libx264', '-crf', '28', '-preset', 'fast', output_path]

        process = subprocess.run(command, capture_output=True, text=True)

        if process.returncode != 0:
            raise Exception(f"ffmpeg error: {process.stderr}")

        # Serve the compressed file with correct MIME type
        with open(output_path, 'rb') as f:
            data = f.read()

        response = Response(data, mimetype='video/mp4')
        response.headers['Content-Disposition'] = 'attachment; filename=output.mp4'
        return response

    except Exception as e:
        frappe.log_error(message=str(e), title="Video Compression Error")
        return {'error': str(e)}, 500
