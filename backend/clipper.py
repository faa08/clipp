from moviepy import VideoFileClip


def extract_clip(
    source_path: str,
    output_path: str,
    start_time: int = 0,
    duration: int = 30,
) -> bool:
    """
    Extracts a sub-clip from source_path and saves it to output_path.
    Returns True on success, False on failure.
    """
    try:
        with VideoFileClip(source_path) as video:
            total_duration = video.duration

            # Guard: if start_time is beyond the video length, default to 0
            if start_time >= total_duration:
                start_time = 0

            end_time = min(start_time + duration, total_duration)

            clip = video.subclipped(start_time, end_time)
            clip.write_videofile(
                output_path,
                codec="libx264",
                audio_codec="aac",
                logger=None,  # suppress verbose moviepy output
            )
        return True
    except Exception as exc:
        print(f"Clip extraction failed: {exc}")
        return False
