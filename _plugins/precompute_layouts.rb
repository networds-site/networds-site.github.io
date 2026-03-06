Jekyll::Hooks.register :site, :post_write do |site|
  puts "🔧 Precomputing puzzle layouts..."

  script_path = File.join(site.source, 'scripts', 'precompute_layouts.js')

  if File.exist?(script_path)
    # Try to run the Node.js script
    result = system("node #{script_path}")

    if result
      puts "✅ Puzzle layouts precomputed successfully"
    else
      puts "⚠️  Failed to run precompute script. Make sure Node.js is installed."
      puts "   You can run manually: node scripts/precompute_layouts.js"
    end
  else
    puts "⚠️  Precompute script not found at: #{script_path}"
  end
end
