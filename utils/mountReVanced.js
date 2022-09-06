const { writeFileSync } = require('node:fs');

const exec = require('./promisifiedExec.js');

/**
 * @param {string} pkg
 * @param {import('ws').WebSocket} ws
 */
module.exports = async function mountReVanced(pkg, ws) {
  // Copy ReVanced APK to temp.
  // await exec(
  //   `su -c 'cp "revanced/${global.outputName}" "/data/local/tmp/revanced.delete"'`
  // );

  // Create folder
  await exec('su -c \'mkdir -p "/data/adb/revanced/"\'');

  // Copy ReVanced APK to revanced dir.
  await exec(
    `su -c 'cp "revanced/${global.outputName}" "/data/adb/revanced/${pkg}.apk"'`
  );

  // Unmount the already existing ReVanced APK, so it can be updated
  try {
    // Force stop the app
    await exec(`su -c 'am force-stop ${pkg}'`);
    // Unmount
    await exec(
      `su -mm -c 'stock_path="$(pm path ${pkg} | grep base | sed 's/package://g')" && umount -l "$stock_path"'`
    );
    // eslint-disable-next-line no-empty
  } catch {} // An error occured, probably because there is no existing ReVanced APK to be unmounted, ignore it and continue

  // Move APK to folder
  await exec(
    `su -c 'base_path="/data/adb/revanced/${pkg}.apk" && chmod 644 "$base_path" && chown system:system "$base_path" && chcon u:object_r:apk_data_file:s0 "$base_path"'`
  );

  // Create mount script
  writeFileSync(
    'mount.sh',
    `#!/system/bin/sh
    while [ "$(getprop sys.boot_completed | tr -d '\r')" != "1" ]; do sleep 1; done

    base_path="/data/adb/revanced/${pkg}.apk"
    stock_path=$(pm path ${pkg} | grep base | sed 's/package://g')
    chcon u:object_r:apk_data_file:s0 $base_path
    mount -o bind $base_path $stock_path`
  );

  // Move Mount script to folder
  await exec(
    `su -c 'cp "./mount.sh" "/data/adb/service.d/mount_revanced_${pkg}.sh"'`
  );
  // Give execution perms to Mount script
  await exec(`su -c 'chmod +x "/data/adb/service.d/mount_revanced_${pkg}.sh"'`);

  // Unmount APK
  // await exec(
  //  `su -c 'stock_path="$(pm path ${pkg} | grep base | sed 's/package://g')" && umount -l "$stock_path"'`
  // );

  // Run Mount script
  await exec(`su -mm -c '"/data/adb/service.d/mount_revanced_${pkg}.sh"'`);

  // Kill mounted process
  // await exec(`su -c 'monkey -p ${pkg} 1 && kill $(pidof -s ${pkg})'`);

  // Mount APK with command so it doesn't require restart
  // await exec(
  //   `su -mm -c 'base_path="/data/adb/revanced/${pkg}.apk"; stock_path=$(pm path ${pkg} | grep base | sed 's/package://g'); mount -o bind $base_path $stock_path'`
  // );

  // Kill app process
  await exec(`su -c 'am force-stop ${pkg}'`);

  ws.send(
    JSON.stringify({
      event: 'patchLog',
      log: 'ReVanced should be now mounted! Please restart the device and check if the app has been mounted.'
    })
  );
};
