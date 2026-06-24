import { useState, useEffect } from "react";

/**
 * Определяет ОС пользователя по navigator.userAgent.
 * Используется модалкой скачивания, чтобы подсветить нужную платформу.
 *
 * @returns {{ platform: "windows"|"macos"|"linux"|"android"|"ios"|"unknown", isMobile: boolean }}
 */
export function useDeviceDetect() {
  const [device, setDevice] = useState({ platform: "windows", isMobile: false });

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    let platform = "windows";

    if (/Windows/i.test(ua)) platform = "windows";
    else if (/iPhone|iPad|iPod|iOS/i.test(ua)) platform = "ios";
    else if (/Mac OS X|Macintosh/i.test(ua)) platform = "macos";
    else if (/Android/i.test(ua)) platform = "android";
    else if (/Linux/i.test(ua)) platform = "linux";

    setDevice({ platform, isMobile });
  }, []);

  return device;
}

export default useDeviceDetect;
